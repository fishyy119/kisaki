/**
 * Comic file auto sync.
 *
 * Keeps every comic with a library directory in step with its files: when a
 * container appears, changes, or disappears, that entry re-syncs on its own.
 *
 * Watchers only report what changes from now on, so a directory that just
 * entered the watch set is also synced once: at startup, when an entry gains a
 * directory, and when its directory moves. Those passes are cheap because sync
 * reuses stored probe results for files whose size and mtime did not change.
 *
 * This is background upkeep: it creates no task run and shows no notification,
 * and the renderer refreshes from the resulting database changes.
 */

import path from 'node:path'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { DbHooks } from '@main/services/db/hooks'
import type { FileWatchEvent, FileWatchScope, FileWatchService } from '@main/services/file-watch'
import type { HookUntap } from '@main/hooks'
import { comics } from '@shared/db'
import { isNotNull } from 'drizzle-orm'
import { isComicArchiveFile, isComicPageFile } from './recognition'
import { MAX_COMIC_WALK_DEPTH, type ComicFileSyncHandler } from './sync'

const log = createLogger('MediaFiles')

/** A release usually lands as several files, so let the batch settle first. */
const WATCH_DEBOUNCE_MS = 3_000

/** A download in progress keeps growing; report it once it stops changing. */
const WRITE_FINISH_MS = 2_000

/** Sync lists containers, so only a couple of entries reconcile at a time. */
const MAX_CONCURRENT_SYNCS = 2

export interface ComicAutoSyncOptions {
  dbService: DbService
  fileWatch: FileWatchService
  dbHooks: DbHooks
  sync: ComicFileSyncHandler
}

export class ComicAutoSync {
  /** Resolved library directory per comic id, matching the watched roots. */
  private directories = new Map<string, string>()
  /** Reverse of `directories`, for routing an event root back to its entry. */
  private comicIdsByDirectory = new Map<string, string>()
  private readonly queued = new Set<string>()
  private readonly running = new Set<string>()
  private readonly untaps: HookUntap[] = []
  private scope: FileWatchScope | null = null

  constructor(private readonly options: ComicAutoSyncOptions) {}

  start(): void {
    this.setDirectories(this.readDirectories())

    this.scope = this.options.fileWatch.watch({
      id: 'comic-files',
      paths: [...this.directories.values()],
      depth: MAX_COMIC_WALK_DEPTH + 1,
      debounceMs: WATCH_DEBOUNCE_MS,
      awaitWriteFinishMs: WRITE_FINISH_MS,
      onEvents: (events) => this.handleEvents(events)
    })

    this.untaps.push(
      this.options.dbHooks.dbChanged.tap(({ changes }) => {
        if (changes.some((change) => change.table === 'comics')) {
          this.reconcileDirectories()
        }
      })
    )

    // Mounting says nothing about files that already exist, so every watched
    // entry reconciles once here.
    for (const comicId of this.directories.keys()) {
      this.enqueue(comicId)
    }

    log.info('Watching comic library directories.', { watchedCount: this.directories.size })
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
      (comicId) => this.directories.get(comicId) !== next.get(comicId)
    )
    const removed = [...this.directories.keys()].filter((comicId) => !next.has(comicId))
    if (appeared.length === 0 && removed.length === 0) return

    this.setDirectories(next)
    this.scope?.setPaths([...next.values()])

    for (const comicId of appeared) {
      this.enqueue(comicId)
    }
  }

  private setDirectories(directories: Map<string, string>): void {
    this.directories = directories
    this.comicIdsByDirectory = new Map(
      [...directories].map(([comicId, dirPath]) => [dirPath, comicId])
    )
  }

  private handleEvents(events: readonly FileWatchEvent[]): void {
    const touched = new Set(
      events
        .filter((event) => isComicArchiveFile(event.path) || isComicPageFile(event.path))
        .flatMap((event) => {
          const comicId = this.comicIdsByDirectory.get(event.root)
          return comicId ? [comicId] : []
        })
    )

    for (const comicId of touched) {
      this.enqueue(comicId)
    }
  }

  /** One pending sync per entry: further changes collapse into the next pass. */
  private enqueue(comicId: string): void {
    if (this.queued.has(comicId)) return

    this.queued.add(comicId)
    this.drain()
  }

  private drain(): void {
    while (this.running.size < MAX_CONCURRENT_SYNCS) {
      const comicId = [...this.queued].find((candidate) => !this.running.has(candidate))
      if (!comicId) return

      this.queued.delete(comicId)
      this.running.add(comicId)
      void this.runSync(comicId).finally(() => {
        this.running.delete(comicId)
        this.drain()
      })
    }
  }

  /** Syncs by id so the stored library directory stays the single authority. */
  private async runSync(comicId: string): Promise<void> {
    if (!this.directories.has(comicId)) return

    try {
      const result = await this.options.sync.sync({ comicId })
      log.info('Synced comic files after change.', {
        comicId,
        chapterCount: result.chapterCount,
        fileCount: result.fileCount
      })
    } catch (error) {
      log.error('Failed to sync comic files after change.', error, { comicId })
    }
  }

  private readDirectories(): Map<string, string> {
    try {
      const rows = this.options.dbService.client
        .select({ id: comics.id, comicDirPath: comics.comicDirPath })
        .from(comics)
        .where(isNotNull(comics.comicDirPath))
        .all()

      return new Map(
        rows.flatMap((row) =>
          row.comicDirPath ? [[row.id, path.resolve(row.comicDirPath)] as const] : []
        )
      )
    } catch (error) {
      log.error('Failed to read comic library directories.', error)
      return new Map()
    }
  }
}
