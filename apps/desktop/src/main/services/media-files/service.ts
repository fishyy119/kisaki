/**
 * Media Files Service
 *
 * Owns the seam between a user's files on disk and the consumption-unit rows
 * they play or read: which files an entry has, who owns each row, and keeping
 * both in step as the directory changes. Metadata written from provider facts
 * belongs to ingest; this service never scrapes.
 *
 * The domain grows one media type at a time, because recognition, probing, and
 * consumption shape differ per type. Anime, comic, and novel are the shipped
 * handlers.
 */

import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { AnimeAutoSync, AnimeFileSyncHandler } from './anime'
import { ComicAutoSync, ComicFileSyncHandler } from './comic'
import { NovelAutoSync, NovelFileSyncHandler } from './novel'
import { registerMediaFilesIpc } from './ipc'

const log = createLogger('MediaFiles')

export class MediaFilesService implements IContentService {
  readonly id = 'media-files'
  readonly deps = [
    'db',
    'file-watch',
    'ipc',
    'media-info'
  ] as const satisfies readonly ServiceName[]

  anime!: AnimeFileSyncHandler
  comic!: ComicFileSyncHandler
  novel!: NovelFileSyncHandler

  private animeAutoSync!: AnimeAutoSync
  private comicAutoSync!: ComicAutoSync
  private novelAutoSync!: NovelAutoSync
  private untapAppReady!: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const fileWatch = container.get('file-watch')
    const mediaInfo = container.get('media-info')

    this.anime = new AnimeFileSyncHandler(dbService, mediaInfo)
    this.comic = new ComicFileSyncHandler(dbService, mediaInfo)
    this.novel = new NovelFileSyncHandler(dbService, mediaInfo)
    this.animeAutoSync = new AnimeAutoSync({
      dbService,
      fileWatch,
      dbHooks: dbService.hooks,
      sync: this.anime
    })
    this.comicAutoSync = new ComicAutoSync({
      dbService,
      fileWatch,
      dbHooks: dbService.hooks,
      sync: this.comic
    })
    this.novelAutoSync = new NovelAutoSync({
      dbService,
      fileWatch,
      dbHooks: dbService.hooks,
      sync: this.novel
    })
    // Mounting also reconciles every watched directory, so it waits for the app
    // to be ready instead of competing with startup for disk.
    this.untapAppReady = bootstrapHooks.appReady.tap(() => {
      this.animeAutoSync.start()
      this.comicAutoSync.start()
      this.novelAutoSync.start()
    })

    registerMediaFilesIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapAppReady()
    await this.animeAutoSync.dispose()
    await this.comicAutoSync.dispose()
    await this.novelAutoSync.dispose()
    log.info('Disposed')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['anime', 'comic', 'novel']
  }
}
