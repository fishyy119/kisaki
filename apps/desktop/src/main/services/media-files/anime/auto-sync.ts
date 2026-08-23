/**
 * Anime file auto sync.
 *
 * Keeps every anime with a library directory in step with its files: when a
 * video appears, changes, or disappears, that entry re-syncs on its own. The
 * user never has to press sync for a newly downloaded episode.
 *
 * Watchers only report what changes from now on, so a directory that just
 * entered the watch set is also synced once: at startup (covering episodes
 * downloaded while the app was closed), when an entry gains a directory, and
 * when its directory moves. Those passes are cheap because sync reuses stored
 * probe results for files whose size and mtime did not change.
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
import { animes } from '@shared/db'
import { isNotNull } from 'drizzle-orm'
import { isVideoFile } from './recognition'
import { MAX_WALK_DEPTH, type AnimeFileSyncHandler } from './sync'

const log = createLogger('MediaFiles')

/** A release usually lands as several files, so let the batch settle first. */
const WATCH_DEBOUNCE_MS = 3_000

/** A download in progress keeps growing; report it once it stops changing. */
const WRITE_FINISH_MS = 2_000

/** Sync probes files, so only a couple of entries reconcile at a time. */
const MAX_CONCURRENT_SYNCS = 2

export interface AnimeAutoSyncOptions {
  dbService: DbService
  fileWatch: FileWatchService
  dbHooks: DbHooks
  sync: AnimeFileSyncHandler
}

export class AnimeAutoSync {
  /** Resolved library directory per anime id, matching the watched roots. */
  private directories = new Map<string, string>()
  /** Reverse of `directories`, for routing an event root back to its entry. */
  private animeIdsByDirectory = new Map<string, string>()
  private readonly queued = new Set<string>()
  private readonly running = new Set<string>()
  private readonly untaps: HookUntap[] = []
  private scope: FileWatchScope | null = null

  constructor(private readonly options: AnimeAutoSyncOptions) {}

  start(): void {
    this.setDirectories(this.readDirectories())

    this.scope = this.options.fileWatch.watch({
      id: 'anime-files',
      paths: [...this.directories.values()],
      depth: MAX_WALK_DEPTH,
      debounceMs: WATCH_DEBOUNCE_MS,
      awaitWriteFinishMs: WRITE_FINISH_MS,
      onEvents: (events) => this.handleEvents(events)
    })

    this.untaps.push(
      this.options.dbHooks.dbChanged.tap(({ changes }) => {
        if (changes.some((change) => change.table === 'animes')) {
          this.reconcileDirectories()
        }
      })
    )

    // Mounting says nothing about files that already exist, so every watched
    // entry reconciles once here.
    for (const animeId of this.directories.keys()) {
      this.enqueue(animeId)
    }

    log.info('Watching anime library directories.', { watchedCount: this.directories.size })
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
      (animeId) => this.directories.get(animeId) !== next.get(animeId)
    )
    const removed = [...this.directories.keys()].filter((animeId) => !next.has(animeId))
    if (appeared.length === 0 && removed.length === 0) return

    this.setDirectories(next)
    this.scope?.setPaths([...next.values()])

    for (const animeId of appeared) {
      this.enqueue(animeId)
    }
  }

  private setDirectories(directories: Map<string, string>): void {
    this.directories = directories
    this.animeIdsByDirectory = new Map(
      [...directories].map(([animeId, dirPath]) => [dirPath, animeId])
    )
  }

  private handleEvents(events: readonly FileWatchEvent[]): void {
    const touched = new Set(
      events
        .filter((event) => isVideoFile(event.path))
        .flatMap((event) => {
          const animeId = this.animeIdsByDirectory.get(event.root)
          return animeId ? [animeId] : []
        })
    )

    for (const animeId of touched) {
      this.enqueue(animeId)
    }
  }

  /** One pending sync per entry: further changes collapse into the next pass. */
  private enqueue(animeId: string): void {
    if (this.queued.has(animeId)) return

    this.queued.add(animeId)
    this.drain()
  }

  private drain(): void {
    while (this.running.size < MAX_CONCURRENT_SYNCS) {
      const animeId = [...this.queued].find((candidate) => !this.running.has(candidate))
      if (!animeId) return

      this.queued.delete(animeId)
      this.running.add(animeId)
      void this.runSync(animeId).finally(() => {
        this.running.delete(animeId)
        this.drain()
      })
    }
  }

  /** Syncs by id so the stored library directory stays the single authority. */
  private async runSync(animeId: string): Promise<void> {
    if (!this.directories.has(animeId)) return

    try {
      const result = await this.options.sync.sync({ animeId })
      log.info('Synced anime files after change.', {
        animeId,
        episodeCount: result.episodeCount,
        fileCount: result.fileCount,
        extraCount: result.extraCount
      })
    } catch (error) {
      log.error('Failed to sync anime files after change.', error, { animeId })
    }
  }

  private readDirectories(): Map<string, string> {
    try {
      const rows = this.options.dbService.client
        .select({ id: animes.id, animeDirPath: animes.animeDirPath })
        .from(animes)
        .where(isNotNull(animes.animeDirPath))
        .all()

      return new Map(
        rows.flatMap((row) =>
          row.animeDirPath ? [[row.id, path.resolve(row.animeDirPath)] as const] : []
        )
      )
    } catch (error) {
      log.error('Failed to read anime library directories.', error)
      return new Map()
    }
  }
}
