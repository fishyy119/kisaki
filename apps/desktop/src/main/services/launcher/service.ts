/**
 * Launcher Service
 *
 * Handles launching media content (games, videos, etc.).
 * Provides namespace-style access to media-specific handlers.
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { GameLauncherHandler } from './handlers/game'
import { createLauncherHooks } from './hooks'
import { registerLauncherIpc } from './ipc'

const log = createLogger('Launcher')

export class LauncherService implements IMediaService {
  readonly id = 'launcher'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'monitor',
    'native',
    'notify'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createLauncherHooks()

  game!: GameLauncherHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const monitorService = container.get('monitor')
    const ipcService = container.get('ipc')
    const nativeService = container.get('native')
    const notifyService = container.get('notify')
    const i18nService = container.get('i18n')

    this.game = new GameLauncherHandler(
      dbService,
      monitorService,
      nativeService,
      notifyService,
      i18nService,
      this.hooks
    )
    registerLauncherIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
