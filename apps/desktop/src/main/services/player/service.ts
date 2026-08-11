/**
 * Player Service
 *
 * Technical service for media playback: it plays a file with track preferences
 * and reports position, and it knows nothing about anime, episodes, or library
 * rows. Business services translate its hooks into domain progress.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { createPlayerHooks } from './hooks'
import { registerPlayerIpc } from './ipc'
import { PlaybackSessionManager } from './manager'

const log = createLogger('Player')

export class PlayerService implements IService<'player'> {
  readonly id = 'player'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createPlayerHooks()

  readonly sessions = new PlaybackSessionManager(this.hooks)

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')

    this.forwardSessionEvents(ipc)
    registerPlayerIpc(this, ipc)

    log.info('Initialized', { engineAvailable: this.sessions.isEngineAvailable() })
  }

  async dispose(): Promise<void> {
    await this.sessions.dispose()
    log.info('Disposed')
  }

  /** Playback controls are a renderer surface, so session state is broadcast. */
  private forwardSessionEvents(ipc: IpcService): void {
    this.hooks.sessionStarted.tap((state) => ipc.send('player:session-started', state))
    this.hooks.statusChanged.tap((state) => ipc.send('player:session-changed', state))
    this.hooks.progress.tap((progress) => ipc.send('player:session-progress', progress))
    this.hooks.sessionEnded.tap((report) => ipc.send('player:session-ended', report))
  }
}
