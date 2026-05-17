/**
 * Window Service
 *
 * Manages application windows lifecycle.
 */

import { app, BrowserWindow } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { registerWindowIpc } from './ipc'
import { MainWindowController } from './controllers/main'
import { TrayMenuWindowController } from './controllers/tray-menu'

const log = createLogger('Window')

export interface WindowsApi {
  getAll(): BrowserWindow[]
}

export class WindowService implements IService {
  readonly id = 'window'
  readonly deps = ['ipc', 'db'] as const satisfies readonly ServiceName[]

  readonly mainWindow = new MainWindowController()
  readonly trayMenuWindow = new TrayMenuWindowController()
  readonly windows: WindowsApi = {
    getAll: () => BrowserWindow.getAllWindows()
  }

  private readonly onBeforeQuit = (): void => {
    this.mainWindow.markQuitting()
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')
    const dbService = container.get('db')

    this.mainWindow.init({ ipcService, dbService })
    registerWindowIpc(this, ipcService)
    app.on('before-quit', this.onBeforeQuit)

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    app.off('before-quit', this.onBeforeQuit)

    this.trayMenuWindow.dispose()
    this.mainWindow.dispose()

    log.info('Disposed')
  }
}
