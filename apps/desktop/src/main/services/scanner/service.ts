/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - Namespace-style access to one handler per media type
 * - Routing of scanner-id controls to the handler owning that scanner
 * - Discovery utilities shared across all media types
 * - Watch-driven scanning, so a library scans when it actually changes
 */

import { eq } from 'drizzle-orm'
import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { DbService } from '@main/services/db'
import type { MediaType } from '@shared/common'
import { scanners } from '@shared/db'
import { isActiveScannerRunStatus } from '@shared/scanner'
import type { ScannerRunStartResult, ScannerRunState } from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import { AnimeScannerHandler } from './handlers/anime'
import { ComicScannerHandler } from './handlers/comic'
import { GameScannerHandler } from './handlers/game'
import { NovelScannerHandler } from './handlers/novel'
import type { MediaScannerHandler } from './handlers/media-handler'
import { ScannerDiscovery } from './discovery'
import { createScannerHooks } from './hooks'
import { registerScannerIpc } from './ipc'
import { ScannerWatchCoordinator } from './watch'

const log = createLogger('Scanner')

// =============================================================================
// Scanner Service
// =============================================================================

export class ScannerService implements IMediaService {
  readonly id = 'scanner'
  readonly deps = [
    'db',
    'file-watch',
    'i18n',
    'ingest',
    'ipc',
    'media-files',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createScannerHooks()

  game!: GameScannerHandler
  anime!: AnimeScannerHandler
  comic!: ComicScannerHandler
  novel!: NovelScannerHandler
  discovery!: ScannerDiscovery

  private dbService!: DbService
  private handlers!: Record<MediaType, MediaScannerHandler>
  private watch!: ScannerWatchCoordinator
  private untapAppReady!: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')

    this.dbService = dbService
    this.discovery = new ScannerDiscovery(dbService)

    const deps = {
      discovery: this.discovery,
      dbService,
      ipcService: container.get('ipc'),
      hooks: this.hooks,
      taskRunService: container.get('task-run'),
      i18nService: container.get('i18n')
    }

    this.game = new GameScannerHandler(deps, container.get('ingest'))
    this.anime = new AnimeScannerHandler(
      deps,
      container.get('ingest'),
      container.get('media-files')
    )
    this.comic = new ComicScannerHandler(
      deps,
      container.get('ingest'),
      container.get('media-files')
    )
    this.novel = new NovelScannerHandler(
      deps,
      container.get('ingest'),
      container.get('media-files')
    )
    this.handlers = { game: this.game, anime: this.anime, comic: this.comic, novel: this.novel }

    this.watch = new ScannerWatchCoordinator({
      dbService,
      fileWatch: container.get('file-watch'),
      dbHooks: dbService.hooks,
      hooks: this.hooks,
      startScan: async (scannerId, initiator) => {
        await this.resolveHandler(scannerId).startScanner(scannerId, initiator)
      },
      isScanActive: (scannerId) => this.isScanActive(scannerId)
    })
    this.untapAppReady = bootstrapHooks.appReady.tap(() => {
      this.watch.start()
    })

    registerScannerIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapAppReady()
    await this.watch.dispose()

    for (const handler of Object.values(this.handlers)) {
      handler.cleanup()
    }
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return Object.keys(this.handlers) as MediaType[]
  }

  /** Run states across every media type, since one UI lists them together. */
  listRunStates(): ScannerRunState[] {
    return Object.values(this.handlers).flatMap((handler) => handler.listRunStates())
  }

  /** Whether a scanner already has a queued or running scan, from any trigger. */
  isScanActive(scannerId: string): boolean {
    return this.listRunStates().some(
      (state) => state.scannerId === scannerId && isActiveScannerRunStatus(state.status)
    )
  }

  async startAllScanners(initiator?: TaskRunInitiator): Promise<ScannerRunStartResult[]> {
    const starts: ScannerRunStartResult[] = []
    for (const handler of Object.values(this.handlers)) {
      starts.push(...(await handler.startAllScanners(initiator)))
    }
    return starts
  }

  /**
   * Handler owning a scanner record.
   *
   * A scanner id is unique across media types, so controls route by the stored
   * media type rather than being asked for it.
   */
  resolveHandler(scannerId: string): MediaScannerHandler {
    const [scanner] = this.dbService.client
      .select({ type: scanners.type })
      .from(scanners)
      .where(eq(scanners.id, scannerId))
      .limit(1)
      .all()

    const handler = scanner ? this.handlers[scanner.type] : undefined
    if (!handler) {
      throw new Error(`Scanner not found: ${scannerId}`)
    }

    return handler
  }

  resolveMediaHandler(mediaType: MediaType): MediaScannerHandler {
    return this.handlers[mediaType]
  }
}
