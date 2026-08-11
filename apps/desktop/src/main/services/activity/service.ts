/**
 * Activity Service
 *
 * Business owner of media consumption: which entity is being consumed right
 * now, how a consumption action starts and stops, and what a finished session
 * records. Technical mechanics live in the `process` and `player` services;
 * each media type keeps its own explicit handler here.
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { AnimeActivityHandler } from './handlers/anime'
import { GameActivityHandler } from './handlers/game'
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
    'player',
    'attachment'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createActivityHooks()

  game!: GameActivityHandler
  anime!: AnimeActivityHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    const db = container.get('db')

    this.game = new GameActivityHandler(
      db,
      container.get('process'),
      container.get('native'),
      container.get('i18n'),
      ipc,
      container.get('attachment').game,
      this.hooks
    )

    this.anime = new AnimeActivityHandler(db, container.get('player'), ipc, this.hooks)

    registerActivityIpc(this, ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    await this.anime.dispose()
    await this.game.dispose()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game', 'anime']
  }
}
