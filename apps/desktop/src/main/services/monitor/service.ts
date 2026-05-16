/**
 * Monitor Service
 *
 * Manages process monitoring for media playback/runtime tracking.
 * Provides namespace-style access to media-specific handlers.
 */

import { createLogger } from '@main/log'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { GameMonitorHandler } from './handlers/game'
import { registerMonitorIpc } from './ipc'

const log = createLogger('Monitor')

export class MonitorService implements IMediaService {
  readonly id = 'monitor'
  readonly deps = ['db', 'ipc', 'event', 'attachment'] as const satisfies readonly ServiceName[]

  game!: GameMonitorHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const eventService = container.get('event')
    const attachmentService = container.get('attachment')

    // Create handler with attachment handler for auto-backup
    this.game = new GameMonitorHandler(dbService, ipcService, eventService, attachmentService.game)

    registerMonitorIpc(this, ipcService)
    log.info('Initialized')
  }

  getGameStatus(gameId?: string) {
    if (!gameId) {
      return this.game.getMonitoringStatus()
    }

    const status = this.game.getGameStatus(gameId)
    if (!status) {
      throw new Error(`No status found for game ${gameId}`)
    }
    return status
  }

  computeEffectivePath(
    config: Parameters<typeof GameMonitorHandler.computeEffectiveMonitorPath>[0]
  ) {
    return GameMonitorHandler.computeEffectiveMonitorPath(config)
  }

  async dispose(): Promise<void> {
    await this.game.cleanup()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
