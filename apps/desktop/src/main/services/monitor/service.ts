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
import { createMonitorHooks } from './hooks'
import { registerMonitorIpc } from './ipc'

const log = createLogger('Monitor')

export class MonitorService implements IMediaService {
  readonly id = 'monitor'
  readonly deps = ['db', 'ipc', 'attachment'] as const satisfies readonly ServiceName[]
  readonly hooks = createMonitorHooks()

  game!: GameMonitorHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const attachmentService = container.get('attachment')

    // Create handler with attachment handler for auto-backup
    this.game = new GameMonitorHandler(dbService, ipcService, this.hooks, attachmentService.game)

    registerMonitorIpc(this, ipcService)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    await this.game.cleanup()
    log.info('Disposed')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
