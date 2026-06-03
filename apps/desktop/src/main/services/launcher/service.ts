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
import { registerLauncherIpc } from './ipc'

const log = createLogger('Launcher')

export class LauncherService implements IMediaService {
  readonly id = 'launcher'
  readonly deps = [
    'db',
    'ipc',
    'monitor',
    'native',
    'notify'
  ] as const satisfies readonly ServiceName[]

  game!: GameLauncherHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const monitorService = container.get('monitor')
    const ipcService = container.get('ipc')
    const nativeService = container.get('native')
    const notifyService = container.get('notify')

    this.game = new GameLauncherHandler(dbService, monitorService, nativeService, notifyService)
    registerLauncherIpc(this, ipcService)
    log.info('Initialized')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
