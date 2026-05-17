/**
 * Native Service
 *
 * Coordinates native desktop integration capabilities.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { NativeAutoLaunch } from './auto-launch'
import { NativeDialogs } from './dialogs'
import { NativeShell } from './shell'
import { NativeTray } from './tray'
import { registerNativeIpc } from './ipc'

const log = createLogger('Native')

export class NativeService implements IService {
  readonly id = 'native'
  readonly deps = ['ipc', 'window'] as const satisfies readonly ServiceName[]

  readonly autoLaunch = new NativeAutoLaunch()
  readonly shell = new NativeShell()

  dialogs!: NativeDialogs
  tray!: NativeTray

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')
    const windowService = container.get('window')

    this.dialogs = new NativeDialogs({ windowService })
    this.tray = new NativeTray({ windowService })

    registerNativeIpc(this, ipcService)
    this.tray.init()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.tray.dispose()
    log.info('Disposed')
  }
}
