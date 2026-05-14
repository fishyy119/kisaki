/**
 * Launcher Service
 *
 * Handles launching media content (games, videos, etc.).
 * Provides namespace-style access to media-specific handlers.
 */

import log from 'electron-log/main'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import type { DbService } from '@main/services/db'
import { GameLauncherHandler } from './handlers/game'
import { applyDefaultLaunchConfig } from './presets/defaults'
import { registerLauncherIpc } from './ipc'

export class LauncherService implements IMediaService {
  readonly id = 'launcher'
  readonly deps = ['db', 'ipc', 'monitor', 'native'] as const satisfies readonly ServiceName[]

  private dbService!: DbService
  game!: GameLauncherHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbService = container.get('db')
    const monitorService = container.get('monitor')
    const ipcService = container.get('ipc')
    const nativeService = container.get('native')

    this.game = new GameLauncherHandler(this.dbService, monitorService, nativeService)
    registerLauncherIpc(this, ipcService)
    log.info('[LauncherService] Initialized')
  }

  applyDefaultConfig(gameId: string, filePath: string): Promise<void> {
    return applyDefaultLaunchConfig(this.dbService, gameId, filePath)
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
