/**
 * Holdings Service
 *
 * Holdings are what the user actually has: the seam between their files on disk
 * and the consumption-unit rows that play or read them. This service answers
 * which files an entry has, who owns each row (`isManual`), and keeps both in
 * step as the directory changes. The catalog says what exists; holdings say
 * what is on hand — an entry with an empty holding is normal, not an error.
 *
 * Metadata written from provider facts belongs to ingest; this service never
 * scrapes. App-owned asset bytes (covers, backdrops) belong to attachment.
 *
 * Owning those rows also makes it the only place that can turn a unit file-row
 * id into a path, so it registers the `book://` transport's resolver.
 *
 * The domain grows one media type at a time, because recognition, probing, and
 * consumption shape differ per type. Anime, comic, and novel are the shipped
 * coordinators, addressed as `holdings.<media>`.
 */

import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { animeAutoSyncSpec, AnimeFileSyncCoordinator } from './anime'
import { AutoSyncCoordinator } from './auto-sync'
import { comicAutoSyncSpec, ComicFileSyncCoordinator } from './comic'
import { novelAutoSyncSpec, NovelFileSyncCoordinator } from './novel'
import { registerHoldingsIpc } from './ipc'

const log = createLogger('Holdings')

export class HoldingsService implements IService<'holdings'> {
  readonly id = 'holdings'
  readonly deps = [
    'db',
    'file-watch',
    'ipc',
    'reader',
    'video'
  ] as const satisfies readonly ServiceName[]

  anime!: AnimeFileSyncCoordinator
  comic!: ComicFileSyncCoordinator
  novel!: NovelFileSyncCoordinator

  private autoSyncs: AutoSyncCoordinator[] = []
  private untapAppReady!: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const fileWatch = container.get('file-watch')
    const reader = container.get('reader')

    this.anime = new AnimeFileSyncCoordinator(dbService, container.get('video').probe)
    this.comic = new ComicFileSyncCoordinator(dbService, reader.books)
    this.novel = new NovelFileSyncCoordinator(dbService)

    this.autoSyncs = [
      animeAutoSyncSpec(dbService, this.anime),
      comicAutoSyncSpec(dbService, this.comic),
      novelAutoSyncSpec(dbService, this.novel)
    ].map((spec) => new AutoSyncCoordinator({ fileWatch, dbHooks: dbService.hooks, spec }))

    reader.setUnitFileResolver((kind, fileId) =>
      kind === 'comic' ? this.comic.findFilePath(fileId) : this.novel.findFilePath(fileId)
    )

    // Mounting also reconciles every watched directory, so it waits for the app
    // to be ready instead of competing with startup for disk.
    this.untapAppReady = bootstrapHooks.appReady.tap(() => {
      for (const autoSync of this.autoSyncs) {
        autoSync.start()
      }
    })

    registerHoldingsIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapAppReady()
    await Promise.all(this.autoSyncs.map((autoSync) => autoSync.dispose()))
    log.info('Disposed')
  }
}
