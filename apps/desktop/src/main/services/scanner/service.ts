/**
 * Scanner Service
 *
 * Manages media scanning from disk.
 * Provides:
 * - A single run coordinator over the per-media spec registry
 * - An application-wide entity budget shared by every scan run
 * - Discovery utilities shared across all media types
 * - Watch-driven scanning, so a library scans when it actually changes
 */

import { eq } from 'drizzle-orm'
import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { HookUntap } from '@main/hooks'
import type { DbService } from '@main/services/db'
import { Semaphore } from '@main/utils/async'
import { scanners, type Scanner } from '@shared/db'
import { isActiveScannerRunStatus } from '@shared/scanner'
import type { ScannerRunStartResult, ScannerRunState } from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import { ScannerDiscovery } from './discovery'
import { createScannerHooks } from './hooks'
import { registerScannerIpc } from './ipc'
import { ScannerRunCoordinator } from './run'
import { ScanExecutor } from './scan'
import { ScannerWatchCoordinator } from './watch'

const log = createLogger('Scanner')

export class ScannerService implements IService<'scanner'> {
  readonly id = 'scanner'
  readonly deps = [
    'db',
    'file-watch',
    'i18n',
    'ingest',
    'ipc',
    'holdings',
    'task-run'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createScannerHooks()

  discovery!: ScannerDiscovery

  private dbService!: DbService
  private coordinator!: ScannerRunCoordinator
  private watch!: ScannerWatchCoordinator
  private limiter!: Semaphore
  private limiterPermits = 0
  private untapAppReady!: () => void
  private untapSettings!: HookUntap

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')

    this.dbService = dbService
    this.discovery = new ScannerDiscovery(dbService)

    this.limiterPermits = dbService.settings.get().scannerParallelCount
    this.limiter = new Semaphore(this.limiterPermits)
    this.untapSettings = dbService.hooks.dbChanged.tap(({ changes }) => {
      if (changes.some((change) => change.table === 'settings')) {
        this.rebuildLimiter()
      }
    })

    const executor = new ScanExecutor(
      {
        discovery: this.discovery,
        dbService,
        ingestService: container.get('ingest'),
        holdingsService: container.get('holdings'),
        hooks: this.hooks,
        i18nService: container.get('i18n')
      },
      () => this.limiter
    )

    this.coordinator = new ScannerRunCoordinator({
      ipc: container.get('ipc'),
      taskRun: container.get('task-run'),
      hooks: this.hooks,
      i18n: container.get('i18n'),
      loadScanner: (scannerId) => this.loadScanner(scannerId),
      runScan: (scanner, session) => executor.runScan(scanner, session)
    })

    this.watch = new ScannerWatchCoordinator({
      dbService,
      fileWatch: container.get('file-watch'),
      dbHooks: dbService.hooks,
      hooks: this.hooks,
      startScan: async (scannerId, initiator) => {
        this.startScanner(scannerId, initiator)
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
    this.untapSettings()
    this.untapAppReady()
    await this.watch.dispose()
    this.coordinator.cleanup()
    log.info('Disposed')
  }

  listRunStates(): ScannerRunState[] {
    return this.coordinator.listRunStates()
  }

  /** Whether a scanner already has an active scan, from any trigger. */
  isScanActive(scannerId: string): boolean {
    return this.listRunStates().some(
      (state) => state.scannerId === scannerId && isActiveScannerRunStatus(state.status)
    )
  }

  startScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): ScannerRunStartResult {
    const { start, completed } = this.coordinator.startScanner(scannerId, initiator)
    void completed.catch((error) => {
      log.error('Scanner run failed after start.', error, { scannerId })
    })
    return start
  }

  startAllScanners(initiator: TaskRunInitiator = { type: 'user' }): ScannerRunStartResult[] {
    const starts: ScannerRunStartResult[] = []

    for (const scanner of this.listScanners()) {
      try {
        starts.push(this.startScanner(scanner.id, initiator))
      } catch (error) {
        log.error('Failed to start scanner.', error, { scannerName: scanner.name })
      }
    }

    return starts
  }

  pauseScanner(scannerId: string): boolean {
    return this.coordinator.pauseScanner(scannerId)
  }

  resumeScanner(scannerId: string): boolean {
    return this.coordinator.resumeScanner(scannerId)
  }

  cancelScanner(scannerId: string): boolean {
    return this.coordinator.cancelScanner(scannerId)
  }

  /**
   * Rebuilds the entity budget when the setting changes.
   *
   * Runs capture the semaphore at start, so in-flight scans finish under the
   * budget they started with and new runs pick up the new size.
   */
  private rebuildLimiter(): void {
    const permits = this.dbService.settings.get().scannerParallelCount
    if (permits === this.limiterPermits) return

    this.limiterPermits = permits
    this.limiter = new Semaphore(permits)
    log.info('Scanner entity budget resized.', { permits })
  }

  private loadScanner(scannerId: string): Scanner {
    const [scanner] = this.dbService.client
      .select()
      .from(scanners)
      .where(eq(scanners.id, scannerId))
      .limit(1)
      .all()

    if (!scanner) {
      throw new Error(`Scanner not found: ${scannerId}`)
    }

    return scanner
  }

  private listScanners(): Scanner[] {
    try {
      return this.dbService.client.select().from(scanners).all()
    } catch (error) {
      log.error('Failed to list scanners.', error)
      return []
    }
  }
}
