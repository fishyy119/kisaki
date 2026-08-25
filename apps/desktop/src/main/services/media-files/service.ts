/**
 * Media Files Service
 *
 * Owns the seam between a user's files on disk and the consumption-unit rows
 * they play or read: which files an entry has, who owns each row, and keeping
 * both in step as the directory changes. Metadata written from provider facts
 * belongs to ingest; this service never scrapes.
 *
 * Owning those rows also makes it the only place that can turn a unit file-row
 * id into a path, so it registers the `book://` transport's resolver.
 *
 * The domain grows one media type at a time, because recognition, probing, and
 * consumption shape differ per type. Anime, comic, and novel are the shipped
 * handlers.
 */

import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { animeAutoSyncSpec, AnimeFileSyncHandler } from './anime'
import { AutoSyncCoordinator } from './auto-sync'
import { comicAutoSyncSpec, ComicFileSyncHandler } from './comic'
import { novelAutoSyncSpec, NovelFileSyncHandler } from './novel'
import { registerMediaFilesIpc } from './ipc'

const log = createLogger('MediaFiles')

export class MediaFilesService implements IMediaService {
  readonly id = 'media-files'
  readonly deps = [
    'db',
    'file-watch',
    'ipc',
    'reader',
    'video'
  ] as const satisfies readonly ServiceName[]

  anime!: AnimeFileSyncHandler
  comic!: ComicFileSyncHandler
  novel!: NovelFileSyncHandler

  private autoSyncs: AutoSyncCoordinator[] = []
  private untapAppReady!: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const fileWatch = container.get('file-watch')
    const reader = container.get('reader')

    this.anime = new AnimeFileSyncHandler(dbService, container.get('video').probe)
    this.comic = new ComicFileSyncHandler(dbService, reader.books)
    this.novel = new NovelFileSyncHandler(dbService)

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

    registerMediaFilesIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapAppReady()
    await Promise.all(this.autoSyncs.map((autoSync) => autoSync.dispose()))
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['anime', 'comic', 'novel']
  }
}
