/**
 * Novel file auto sync.
 *
 * Keeps every novel with a library directory in step with its files: when a
 * book file appears, changes, or disappears, that entry re-syncs on its own.
 *
 * Watchers only report what changes from now on, so a directory that just
 * entered the watch set is also synced once: at startup, when an entry gains a
 * directory, and when its directory moves.
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
import { novels } from '@shared/db'
import { isNotNull } from 'drizzle-orm'
import { isNovelBookFile } from './recognition'
import { MAX_NOVEL_WALK_DEPTH, type NovelFileSyncHandler } from './sync'

const log = createLogger('MediaFiles')

/** A release usually lands as several files, so let the batch settle first. */
const WATCH_DEBOUNCE_MS = 3_000

/** A download in progress keeps growing; report it once it stops changing. */
const WRITE_FINISH_MS = 2_000

/** Sync lists book files, so only a couple of entries reconcile at a time. */
const MAX_CONCURRENT_SYNCS = 2

export interface NovelAutoSyncOptions {
  dbService: DbService
  fileWatch: FileWatchService
  dbHooks: DbHooks
  sync: NovelFileSyncHandler
}

export class NovelAutoSync {
  /** Resolved library directory per novel id, matching the watched roots. */
  private directories = new Map<string, string>()
  /** Reverse of `directories`, for routing an event root back to its entry. */
  private novelIdsByDirectory = new Map<string, string>()
  private readonly queued = new Set<string>()
  private readonly running = new Set<string>()
  private readonly untaps: HookUntap[] = []
  private scope: FileWatchScope | null = null

  constructor(private readonly options: NovelAutoSyncOptions) {}

  start(): void {
    this.setDirectories(this.readDirectories())

    this.scope = this.options.fileWatch.watch({
      id: 'novel-files',
      paths: [...this.directories.values()],
      depth: MAX_NOVEL_WALK_DEPTH,
      debounceMs: WATCH_DEBOUNCE_MS,
      awaitWriteFinishMs: WRITE_FINISH_MS,
      onEvents: (events) => this.handleEvents(events)
    })

    this.untaps.push(
      this.options.dbHooks.dbChanged.tap(({ changes }) => {
        if (changes.some((change) => change.table === 'novels')) {
          this.reconcileDirectories()
        }
      })
    )

    // Mounting says nothing about files that already exist, so every watched
    // entry reconciles once here.
    for (const novelId of this.directories.keys()) {
      this.enqueue(novelId)
    }

    log.info('Watching novel library directories.', { watchedCount: this.directories.size })
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
      (novelId) => this.directories.get(novelId) !== next.get(novelId)
    )
    const removed = [...this.directories.keys()].filter((novelId) => !next.has(novelId))
    if (appeared.length === 0 && removed.length === 0) return

    this.setDirectories(next)
    this.scope?.setPaths([...next.values()])

    for (const novelId of appeared) {
      this.enqueue(novelId)
    }
  }

  private setDirectories(directories: Map<string, string>): void {
    this.directories = directories
    this.novelIdsByDirectory = new Map(
      [...directories].map(([novelId, dirPath]) => [dirPath, novelId])
    )
  }

  private handleEvents(events: readonly FileWatchEvent[]): void {
    const touched = new Set(
      events
        .filter((event) => isNovelBookFile(event.path))
        .flatMap((event) => {
          const novelId = this.novelIdsByDirectory.get(event.root)
          return novelId ? [novelId] : []
        })
    )

    for (const novelId of touched) {
      this.enqueue(novelId)
    }
  }

  /** One pending sync per entry: further changes collapse into the next pass. */
  private enqueue(novelId: string): void {
    if (this.queued.has(novelId)) return

    this.queued.add(novelId)
    this.drain()
  }

  private drain(): void {
    while (this.running.size < MAX_CONCURRENT_SYNCS) {
      const novelId = [...this.queued].find((candidate) => !this.running.has(candidate))
      if (!novelId) return

      this.queued.delete(novelId)
      this.running.add(novelId)
      void this.runSync(novelId).finally(() => {
        this.running.delete(novelId)
        this.drain()
      })
    }
  }

  /** Syncs by id so the stored library directory stays the single authority. */
  private async runSync(novelId: string): Promise<void> {
    if (!this.directories.has(novelId)) return

    try {
      const result = await this.options.sync.sync({ novelId })
      log.info('Synced novel files after change.', {
        novelId,
        volumeCount: result.volumeCount,
        fileCount: result.fileCount
      })
    } catch (error) {
      log.error('Failed to sync novel files after change.', error, { novelId })
    }
  }

  private readDirectories(): Map<string, string> {
    try {
      const rows = this.options.dbService.client
        .select({ id: novels.id, novelDirPath: novels.novelDirPath })
        .from(novels)
        .where(isNotNull(novels.novelDirPath))
        .all()

      return new Map(
        rows.flatMap((row) =>
          row.novelDirPath ? [[row.id, path.resolve(row.novelDirPath)] as const] : []
        )
      )
    } catch (error) {
      log.error('Failed to read novel library directories.', error)
      return new Map()
    }
  }
}
