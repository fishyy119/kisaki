/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - Namespace-style access to media-specific handlers (game, anime)
 * - Routing of scanner-id controls to the handler owning that scanner
 * - Discovery utilities shared across all media types
 */

import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { DbService } from '@main/services/db'
import type { MediaType } from '@shared/common'
import { scanners } from '@shared/db'
import type { ScannerRunStartResult, ScannerRunState } from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import { AnimeScannerHandler } from './handlers/anime'
import { GameScannerHandler } from './handlers/game'
import type { MediaScannerHandler } from './handlers/common'
import { ScannerDiscovery } from './discovery'
import { createScannerHooks } from './hooks'
import { registerScannerIpc } from './ipc'

const log = createLogger('Scanner')

// =============================================================================
// Scanner Service
// =============================================================================

export class ScannerService implements IMediaService {
  readonly id = 'scanner'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'ingest',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createScannerHooks()

  game!: GameScannerHandler
  anime!: AnimeScannerHandler
  discovery!: ScannerDiscovery

  private dbService!: DbService
  private handlers!: Record<MediaType, MediaScannerHandler>

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ingestService = container.get('ingest')

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

    this.game = new GameScannerHandler(deps, ingestService)
    this.anime = new AnimeScannerHandler(deps, ingestService)
    this.handlers = { game: this.game, anime: this.anime }

    registerScannerIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
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

  async scheduleAllScanners(): Promise<void> {
    for (const handler of Object.values(this.handlers)) {
      await handler.scheduleAllScanners()
    }
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
