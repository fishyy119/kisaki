/**
 * One filesystem watch subscription.
 *
 * Watches a set of roots and delivers debounced batches of normalized events.
 * Every event carries the root that owns it, so consumers route by owner instead
 * of re-deriving path prefixes.
 *
 * Existing entries are never replayed: a scope reports what changes from now on.
 * Consumers that need the current state reconcile explicitly when they mount a
 * path, which is also what covers changes made while the app was closed.
 *
 * The watch engine is confined to this file; consumers only see the event
 * contract below.
 */

import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { createLogger } from '@main/log'
import { isInsideOrEqualPath } from '@shared/utils/path'

const log = createLogger('Watch')

/** A continuously busy tree must still deliver, so one batch defers at most this long. */
const BATCH_MAX_WAIT_MS = 30_000

/** Size-stability sampling period while a file is still being written. */
const WRITE_FINISH_POLL_INTERVAL_MS = 100

export type FileWatchEventKind = 'add' | 'change' | 'unlink' | 'add-dir' | 'unlink-dir'

export interface FileWatchEvent {
  kind: FileWatchEventKind
  /** Absolute path of the changed entry. */
  path: string
  /** Watched root owning the path; the deepest one when roots nest. */
  root: string
}

export interface FileWatchOptions {
  /** Stable scope identity for logs, such as `scanner` or `anime-files`. */
  id: string
  paths: readonly string[]
  /** Levels below each root to watch; 0 keeps a root's direct children only. */
  depth?: number
  /** Absolute-path predicate; matching paths are neither watched nor reported. */
  ignored?: (candidatePath: string) => boolean
  /** Trailing debounce before a batch is delivered. */
  debounceMs: number
  /**
   * Hold an entry back until its size stops changing for this long, so a file
   * that is still being written is reported once, when it is complete.
   */
  awaitWriteFinishMs?: number
  onEvents: (events: readonly FileWatchEvent[]) => void | Promise<void>
}

export class FileWatchScope {
  /** Keyed by kind and path so a churning file collapses into one batch entry. */
  private readonly pending = new Map<string, FileWatchEvent>()
  private roots: string[]
  private watcher: FSWatcher | null = null
  private flushTimer: NodeJS.Timeout | null = null
  private batchStartedAt = 0
  private closed = false

  constructor(
    private readonly options: FileWatchOptions,
    private readonly onClosed: () => void
  ) {
    this.roots = normalizeRoots(options.paths)
    if (this.roots.length > 0) {
      this.startWatcher()
    }
  }

  /** Applies a new root set as a diff, leaving unchanged roots watched. */
  setPaths(paths: readonly string[]): void {
    if (this.closed) return

    const next = normalizeRoots(paths)
    const added = next.filter((root) => !this.roots.includes(root))
    const removed = this.roots.filter((root) => !next.includes(root))
    if (added.length === 0 && removed.length === 0) return

    this.roots = next

    if (!this.watcher) {
      if (next.length > 0) {
        this.startWatcher()
      }
      return
    }

    if (removed.length > 0) {
      this.watcher.unwatch(removed)
    }
    if (added.length > 0) {
      this.watcher.add(added)
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.pending.clear()

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    this.onClosed()
  }

  private startWatcher(): void {
    const ignored = this.options.ignored
    const awaitWriteFinishMs = this.options.awaitWriteFinishMs

    this.watcher = watch([...this.roots], {
      ignored: ignored ? (candidatePath) => ignored(path.resolve(candidatePath)) : undefined,
      ignoreInitial: true,
      persistent: true,
      ignorePermissionErrors: true,
      depth: this.options.depth,
      awaitWriteFinish:
        awaitWriteFinishMs === undefined
          ? false
          : {
              stabilityThreshold: awaitWriteFinishMs,
              pollInterval: WRITE_FINISH_POLL_INTERVAL_MS
            }
    })

    this.watcher.on('add', (changedPath) => this.enqueue('add', changedPath))
    this.watcher.on('change', (changedPath) => this.enqueue('change', changedPath))
    this.watcher.on('unlink', (changedPath) => this.enqueue('unlink', changedPath))
    this.watcher.on('addDir', (changedPath) => this.enqueue('add-dir', changedPath))
    this.watcher.on('unlinkDir', (changedPath) => this.enqueue('unlink-dir', changedPath))
    this.watcher.on('error', (error) => {
      log.warn('Watcher reported an error.', error, { scopeId: this.options.id })
    })
  }

  private enqueue(kind: FileWatchEventKind, changedPath: string): void {
    if (this.closed) return

    const absolutePath = path.resolve(changedPath)
    const root = this.findRoot(absolutePath)
    if (!root) return

    this.pending.set(`${kind}\0${absolutePath}`, { kind, path: absolutePath, root })
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    const now = Date.now()
    if (this.batchStartedAt === 0) {
      this.batchStartedAt = now
    }

    const remainingBudget = this.batchStartedAt + BATCH_MAX_WAIT_MS - now
    const delay = Math.max(0, Math.min(this.options.debounceMs, remainingBudget))

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }
    this.flushTimer = setTimeout(() => this.flush(), delay)
  }

  private flush(): void {
    this.flushTimer = null
    this.batchStartedAt = 0

    // Roots dropped while the batch waited take their events with them.
    const events = [...this.pending.values()].filter((event) => this.roots.includes(event.root))
    this.pending.clear()
    if (events.length === 0) return

    void Promise.resolve(this.options.onEvents(events)).catch((error) => {
      log.error('Watch consumer failed.', error, { scopeId: this.options.id })
    })
  }

  private findRoot(absolutePath: string): string | null {
    let match: string | null = null

    for (const root of this.roots) {
      if (!isInsideOrEqualPath(root, absolutePath)) continue
      if (!match || root.length > match.length) {
        match = root
      }
    }

    return match
  }
}

function normalizeRoots(paths: readonly string[]): string[] {
  return [...new Set(paths.map((candidatePath) => path.resolve(candidatePath)))].sort(
    (left, right) => left.localeCompare(right)
  )
}
