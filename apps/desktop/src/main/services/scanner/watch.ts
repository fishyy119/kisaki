/**
 * Scanner watch coordination.
 *
 * Replaces interval polling: a watch-enabled scanner scans when its library
 * actually gains an entity directory. Two rules keep that honest:
 *
 * - Only a directory appearing exactly at the scanner's entity depth counts. A
 *   file changing inside an entity is that entity's business, and a removed
 *   directory has nothing to scan.
 * - Mounting a watch also scans once. Watchers report changes from now on, so
 *   the mount scan is what covers everything that happened while the app was
 *   closed, and what makes a newly configured scanner run without being asked.
 */

import path from 'node:path'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { DbHooks } from '@main/services/db/hooks'
import type { FileWatchEvent, FileWatchScope, FileWatchService } from '@main/services/file-watch'
import type { HookUntap } from '@main/hooks'
import { scanners, type Scanner } from '@shared/db'
import type { TaskRunInitiator } from '@shared/task-run'
import { eq } from 'drizzle-orm'
import type { ScannerHooks } from './hooks'

const log = createLogger('Scanner')

/** Libraries gain many directories at once, so let a batch settle before scanning. */
const WATCH_DEBOUNCE_MS = 2_000

export interface ScannerWatchCoordinatorOptions {
  dbService: DbService
  fileWatch: FileWatchService
  dbHooks: DbHooks
  hooks: ScannerHooks
  /** Starts a run for one scanner, routed to the handler owning it. */
  startScan: (scannerId: string, initiator: TaskRunInitiator) => Promise<void>
  /** Whether that scanner already has a queued or running scan. */
  isScanActive: (scannerId: string) => boolean
}

/** The scanner fields a watch depends on; a rename must not remount anything. */
interface WatchedScanner {
  path: string
  entityDepth: number
  scope: FileWatchScope
}

export class ScannerWatchCoordinator {
  private readonly watched = new Map<string, WatchedScanner>()
  /** Scans this coordinator started and has not seen finish yet. */
  private readonly inFlight = new Set<string>()
  /** Scanners that changed while a scan was busy, collapsed into one rerun. */
  private readonly pending = new Set<string>()
  private readonly untaps: HookUntap[] = []

  constructor(private readonly options: ScannerWatchCoordinatorOptions) {}

  /**
   * Mounts every watch-enabled scanner and scans each once.
   *
   * Runs after the app is ready rather than at service init, so scans appear in
   * a task center the renderer is already listening to.
   */
  start(): void {
    this.untaps.push(
      this.options.dbHooks.dbChanged.tap(({ changes }) => {
        const changedIds = changes
          .filter((change) => change.table === 'scanners')
          .map((change) => change.id)
        if (changedIds.length > 0) {
          this.reconcile([...new Set(changedIds)])
        }
      }),
      this.options.hooks.runFinished.tap(({ scannerId }) => {
        this.inFlight.delete(scannerId)
        if (this.pending.delete(scannerId)) {
          this.requestScan(scannerId, { type: 'system', reason: 'watch' })
        }
      })
    )

    for (const scanner of this.listScanners()) {
      if (!scanner.watchEnabled) continue
      this.mount(scanner)
      this.requestScan(scanner.id, { type: 'system', reason: 'startup' })
    }

    log.info('Watching scanners.', { watchedCount: this.watched.size })
  }

  async dispose(): Promise<void> {
    for (const untap of this.untaps) {
      untap()
    }
    this.untaps.length = 0

    await Promise.all([...this.watched.values()].map((entry) => entry.scope.close()))
    this.watched.clear()
    this.inFlight.clear()
    this.pending.clear()
  }

  /**
   * Applies scanner record changes to the mounted watches.
   *
   * Turning a watch on, or changing where or how deep it looks, also scans once:
   * the watch starts empty and only a scan can tell what is already there.
   */
  private reconcile(scannerIds: readonly string[]): void {
    for (const scannerId of scannerIds) {
      const scanner = this.getScanner(scannerId)
      const watched = this.watched.get(scannerId)

      if (!scanner?.watchEnabled) {
        if (watched) {
          this.unmount(scannerId, watched)
        }
        continue
      }

      if (watched) {
        if (watched.path === scanner.path && watched.entityDepth === scanner.entityDepth) {
          continue
        }
        this.unmount(scannerId, watched)
      }

      this.mount(scanner)
      this.requestScan(scannerId, { type: 'system', reason: 'watch' })
    }
  }

  private mount(scanner: Scanner): void {
    const scope = this.options.fileWatch.watch({
      id: `scanner:${scanner.id}`,
      paths: [scanner.path],
      depth: scanner.entityDepth,
      debounceMs: WATCH_DEBOUNCE_MS,
      onEvents: (events) => this.handleEvents(scanner.id, scanner.entityDepth, events)
    })

    this.watched.set(scanner.id, {
      path: scanner.path,
      entityDepth: scanner.entityDepth,
      scope
    })
  }

  private unmount(scannerId: string, watched: WatchedScanner): void {
    this.watched.delete(scannerId)
    this.pending.delete(scannerId)
    void watched.scope.close().catch((error) => {
      log.warn('Failed to stop watching scanner.', error, { scannerId })
    })
  }

  private handleEvents(
    scannerId: string,
    entityDepth: number,
    events: readonly FileWatchEvent[]
  ): void {
    const appeared = events.filter(
      (event) =>
        event.kind === 'add-dir' && countPathSegments(event.root, event.path) === entityDepth + 1
    )
    if (appeared.length === 0) return

    log.info('Scanner library gained entity directories.', {
      scannerId,
      appearedCount: appeared.length
    })
    this.requestScan(scannerId, { type: 'system', reason: 'watch' })
  }

  /** Coalesces into one rerun while a scan for that scanner is still busy. */
  private requestScan(scannerId: string, initiator: TaskRunInitiator): void {
    if (this.inFlight.has(scannerId) || this.options.isScanActive(scannerId)) {
      this.pending.add(scannerId)
      return
    }

    this.inFlight.add(scannerId)
    void this.options.startScan(scannerId, initiator).catch((error) => {
      this.inFlight.delete(scannerId)
      log.error('Failed to start watch-driven scan.', error, { scannerId })
    })
  }

  private listScanners(): Scanner[] {
    try {
      return this.options.dbService.client.select().from(scanners).all()
    } catch (error) {
      log.error('Failed to list scanners for watching.', error)
      return []
    }
  }

  private getScanner(scannerId: string): Scanner | null {
    try {
      const [scanner] = this.options.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.id, scannerId))
        .limit(1)
        .all()
      return scanner ?? null
    } catch (error) {
      log.error('Failed to read scanner for watching.', error, { scannerId })
      return null
    }
  }
}

function countPathSegments(root: string, candidatePath: string): number {
  const relative = path.relative(root, candidatePath)
  return relative.length === 0 ? 0 : relative.split(path.sep).filter(Boolean).length
}
