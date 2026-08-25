/**
 * Video Service
 *
 * The video vertical's technical engine: it plays a file with track preferences
 * and reports position (`sessions`), and it reads container and track facts out
 * of the same files (`probe`). It knows nothing about anime, episodes, or
 * library rows — business services translate its hooks into domain progress and
 * decide what the facts mean.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { createVideoHooks } from './hooks'
import { registerVideoIpc } from './ipc'
import { PlaybackSessionManager } from './manager'
import { VideoProbe } from './probe'

const log = createLogger('Video')

export class VideoService implements IService<'video'> {
  readonly id = 'video'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createVideoHooks()

  readonly sessions = new PlaybackSessionManager(this.hooks)
  readonly probe = new VideoProbe()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')

    this.forwardSessionEvents(ipc)
    registerVideoIpc(this, ipc)

    log.info('Initialized', { engineAvailable: this.sessions.isEngineAvailable() })
  }

  async dispose(): Promise<void> {
    await this.sessions.dispose()
    log.info('Disposed')
  }

  /** Playback controls are a renderer surface, so session state is broadcast. */
  private forwardSessionEvents(ipc: IpcService): void {
    this.hooks.sessionStarted.tap((state) => ipc.send('video:session-started', state))
    this.hooks.statusChanged.tap((state) => ipc.send('video:session-changed', state))
    this.hooks.progress.tap((progress) => ipc.send('video:session-progress', progress))
    this.hooks.sessionEnded.tap((report) => ipc.send('video:session-ended', report))
  }
}
