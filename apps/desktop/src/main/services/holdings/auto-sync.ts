/**
 * Watch-driven file auto sync.
 *
 * Keeps every entry with a library directory in step with its files: when a
 * file appears, changes, or disappears, that entry re-syncs on its own. The
 * user never has to press sync for a newly downloaded unit.
 *
 * Watchers only report what changes from now on, so a directory that just
 * entered the watch set is also synced once: at startup (covering files added
 * while the app was closed), when an entry gains a directory, and when its
 * directory moves. Those passes are cheap because sync reuses stored probe
 * results for files whose size and mtime did not change.
 *
 * This is background upkeep: it creates no task run and shows no notification,
 * and the renderer refreshes from the resulting database changes.
 *
 * The mechanism is one per media type but identical across them, so each type
 * declares an {@link AutoSyncSpec} — its directory query, which files matter,
 * how deep to watch, and how to sync one entry — and this coordinator owns the
 * watch set, the queue, and the concurrency bound.
 */

import path from 'node:path'
import { createLogger } from '@main/log'
import type { DbHooks } from '@main/services/db/hooks'
import type { FileWatchEvent, FileWatchScope, FileWatchService } from '@main/services/file-watch'
import type { HookUntap } from '@main/hooks'
import type { MediaType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'

const log = createLogger('Holdings')

/** A release usually lands as several files, so let the batch settle first. */
const WATCH_DEBOUNCE_MS = 3_000

/** A download in progress keeps growing; report it once it stops changing. */
const WRITE_FINISH_MS = 2_000

/** Sync reads every candidate file, so only a couple of entries run at once. */
const MAX_CONCURRENT_SYNCS = 2

/** One entry's stored library directory, as the entry table holds it. */
export interface AutoSyncDirectoryRow {
  id: string
  dirPath: string | null
}

/** What one pass reconciled, for the log line; units differ per media type. */
export type AutoSyncCounts = Record<string, number>

/** Everything one media type has to say about watching its libraries. */
export interface AutoSyncSpec {
  /** Names the watch scope and every log line. */
  mediaType: MediaType
  /** Entry table as the change feed names it, so entry edits re-read the set. */
  entryTable: TableName
  /** Deepest level the sync pass itself walks; watching further is wasted work. */
  depth: number
  /** Whether a changed path is a file this media type reads. */
  matchesFile: (filePath: string) => boolean
  /** Every entry of this type, with the directory column as stored. */
  readDirectories: () => AutoSyncDirectoryRow[]
  /** Reconciles one entry against its directory. */
  sync: (entryId: string) => Promise<AutoSyncCounts>
}

export interface AutoSyncOptions {
  fileWatch: FileWatchService
  dbHooks: DbHooks
  spec: AutoSyncSpec
}

export class AutoSyncCoordinator {
  /** Resolved library directory per entry id, matching the watched roots. */
  private directories = new Map<string, string>()
  /** Reverse of `directories`, for routing an event root back to its entry. */
  private entryIdsByDirectory = new Map<string, string>()
  private readonly queued = new Set<string>()
  private readonly running = new Set<string>()
  private readonly untaps: HookUntap[] = []
  private scope: FileWatchScope | null = null

  constructor(private readonly options: AutoSyncOptions) {}

  private get spec(): AutoSyncSpec {
    return this.options.spec
  }

  start(): void {
    this.setDirectories(this.readDirectories())

    this.scope = this.options.fileWatch.watch({
      id: `${this.spec.mediaType}-files`,
      paths: [...this.directories.values()],
      depth: this.spec.depth,
      debounceMs: WATCH_DEBOUNCE_MS,
      awaitWriteFinishMs: WRITE_FINISH_MS,
      onEvents: (events) => this.handleEvents(events)
    })

    this.untaps.push(
      this.options.dbHooks.dbChanged.tap(({ changes }) => {
        if (changes.some((change) => change.table === this.spec.entryTable)) {
          this.reconcileDirectories()
        }
      })
    )

    // Mounting says nothing about files that already exist, so every watched
    // entry reconciles once here.
    for (const entryId of this.directories.keys()) {
      this.enqueue(entryId)
    }

    log.info('Watching library directories.', {
      mediaType: this.spec.mediaType,
      watchedCount: this.directories.size
    })
  }

  async dispose(): Promise<void> {
    for (const untap of this.untaps) {
      untap()
    }
    this.untaps.length = 0

    await this.scope?.close()
    this.scope = null
    this.setDirectories(new Map())
    this.queued.clear()
  }

  /**
   * Applies directory changes to the watch set and syncs entries that just
   * became watchable. An entry whose directory did not move is left alone.
   */
  private reconcileDirectories(): void {
    const next = this.readDirectories()
    const appeared = [...next.keys()].filter(
      (entryId) => this.directories.get(entryId) !== next.get(entryId)
    )
    const removed = [...this.directories.keys()].filter((entryId) => !next.has(entryId))
    if (appeared.length === 0 && removed.length === 0) return

    this.setDirectories(next)
    this.scope?.setPaths([...next.values()])

    for (const entryId of appeared) {
      this.enqueue(entryId)
    }
  }

  private setDirectories(directories: Map<string, string>): void {
    this.directories = directories
    this.entryIdsByDirectory = new Map(
      [...directories].map(([entryId, dirPath]) => [dirPath, entryId])
    )
  }

  private handleEvents(events: readonly FileWatchEvent[]): void {
    const touched = new Set(
      events
        .filter((event) => this.spec.matchesFile(event.path))
        .flatMap((event) => {
          const entryId = this.entryIdsByDirectory.get(event.root)
          return entryId ? [entryId] : []
        })
    )

    for (const entryId of touched) {
      this.enqueue(entryId)
    }
  }

  /** One pending sync per entry: further changes collapse into the next pass. */
  private enqueue(entryId: string): void {
    if (this.queued.has(entryId)) return

    this.queued.add(entryId)
    this.drain()
  }

  private drain(): void {
    while (this.running.size < MAX_CONCURRENT_SYNCS) {
      const entryId = [...this.queued].find((candidate) => !this.running.has(candidate))
      if (!entryId) return

      this.queued.delete(entryId)
      this.running.add(entryId)
      void this.runSync(entryId).finally(() => {
        this.running.delete(entryId)
        this.drain()
      })
    }
  }

  /** Syncs by id so the stored library directory stays the single authority. */
  private async runSync(entryId: string): Promise<void> {
    if (!this.directories.has(entryId)) return

    try {
      const counts = await this.spec.sync(entryId)
      log.info('Synced entry files after change.', {
        mediaType: this.spec.mediaType,
        entryId,
        ...counts
      })
    } catch (error) {
      log.error('Failed to sync entry files after change.', error, {
        mediaType: this.spec.mediaType,
        entryId
      })
    }
  }

  private readDirectories(): Map<string, string> {
    try {
      return new Map(
        this.spec
          .readDirectories()
          .flatMap((row) => (row.dirPath ? [[row.id, path.resolve(row.dirPath)] as const] : []))
      )
    } catch (error) {
      log.error('Failed to read library directories.', error, { mediaType: this.spec.mediaType })
      return new Map()
    }
  }
}
