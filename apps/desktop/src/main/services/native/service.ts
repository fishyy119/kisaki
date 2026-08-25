/**
 * Native Service
 *
 * Stateless facades over OS integration points: startup registration, native
 * dialogs, and shell open. Windowed surfaces belong to the window service, so
 * the tray lives there instead of here.
 */

import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { NativeAutoLaunch } from './auto-launch'
import { NativeDialogs } from './dialogs'
import { NativeShell } from './shell'
import { registerNativeIpc } from './ipc'

const log = createLogger('Native')

export class NativeService implements INonDomainService<'native'> {
  readonly id = 'native'
  readonly deps = ['ipc', 'window'] as const

  readonly autoLaunch = new NativeAutoLaunch()
  readonly shell = new NativeShell()

  dialogs!: NativeDialogs

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')

    this.dialogs = new NativeDialogs({ windowService: container.get('window') })

    registerNativeIpc(this, ipcService)
    log.info('Initialized')
  }
}
