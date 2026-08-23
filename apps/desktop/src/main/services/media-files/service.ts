/**
 * Media Files Service
 *
 * Owns the seam between a user's files on disk and the consumption-unit rows
 * they play: which files an entry has, who owns each row, and keeping both in
 * step as the directory changes. Metadata written from provider facts belongs to
 * ingest; this service never scrapes.
 *
 * The domain grows one media type at a time, because recognition, probing, and
 * watch shape differ per type. Anime is the shipped exemplar.
 */

import { bootstrapHooks } from '@main/bootstrap/hooks'
import { createLogger } from '@main/log'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { ContentEntityType } from '@shared/common'
import { AnimeAutoSync, AnimeFileSyncHandler } from './anime'
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

  private animeAutoSync!: AnimeAutoSync
  private untapAppReady!: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')

    this.anime = new AnimeFileSyncHandler(dbService, container.get('media-info'))
    this.animeAutoSync = new AnimeAutoSync({
      dbService,
      fileWatch: container.get('file-watch'),
      dbHooks: dbService.hooks,
      sync: this.anime
    })
    // Mounting also reconciles every watched directory, so it waits for the app
    // to be ready instead of competing with startup for disk.
    this.untapAppReady = bootstrapHooks.appReady.tap(() => {
      this.animeAutoSync.start()
    })

    registerMediaFilesIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapAppReady()
    await this.animeAutoSync.dispose()
    log.info('Disposed')
  }

  getSupportedContent(): ContentEntityType[] {
    return ['anime']
  }
}
