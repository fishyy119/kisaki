/**
 * Native Service
 *
 * Stateless facades over OS integration points: startup registration, native
 * dialogs, shell open, and launcher shortcuts. Windowed surfaces belong to the
 * window service, so the tray lives there instead of here.
 */

import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { NativeAutoLaunch } from './auto-launch'
import { NativeDialogs } from './dialogs'
import { NativeShell } from './shell'
import { NativeShortcuts } from './shortcuts'
import { registerNativeIpc } from './ipc'

const log = createLogger('Native')

export class NativeService implements INonDomainService<'native'> {
  readonly id = 'native'
  readonly deps = ['ipc', 'window'] as const

  readonly autoLaunch = new NativeAutoLaunch()
  readonly shell = new NativeShell()
  readonly shortcuts = new NativeShortcuts()

  dialogs!: NativeDialogs

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')

    this.dialogs = new NativeDialogs({ windowService: container.get('window') })

    registerNativeIpc(this, ipcService)
    log.info('Initialized')
  }
}
