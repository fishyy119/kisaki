/**
 * Activity Service
 *
 * Business owner of media consumption: which entity is being consumed right
 * now, how a consumption action starts and stops, and what a finished session
 * records. Technical mechanics live in the `process`, `video`, and `reader`
 * services; each media type keeps its own explicit handler here.
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { AnimeActivityHandler } from './handlers/anime'
import { ComicActivityHandler } from './handlers/comic'
import { GameActivityHandler } from './handlers/game'
import { NovelActivityHandler } from './handlers/novel'
import { createActivityHooks } from './hooks'
import { registerActivityIpc } from './ipc'

const log = createLogger('Activity')

export class ActivityService implements IMediaService {
  readonly id = 'activity'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'native',
    'process',
    'video',
    'reader',
    'attachment'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createActivityHooks()

  game!: GameActivityHandler
  anime!: AnimeActivityHandler
  comic!: ComicActivityHandler
  novel!: NovelActivityHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    const db = container.get('db')
    const i18n = container.get('i18n')
    const reader = container.get('reader')

    this.game = new GameActivityHandler(
      db,
      container.get('process'),
      container.get('native'),
      i18n,
      ipc,
      container.get('attachment').game,
      this.hooks
    )

    this.anime = new AnimeActivityHandler(db, container.get('video'), ipc, this.hooks)
    this.comic = new ComicActivityHandler(db, reader, i18n, ipc, this.hooks)
    this.novel = new NovelActivityHandler(db, reader, i18n, ipc, this.hooks)

    registerActivityIpc(this, ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    await this.anime.dispose()
    await this.game.dispose()
    this.comic.dispose()
    this.novel.dispose()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game', 'anime', 'comic', 'novel']
  }
}
