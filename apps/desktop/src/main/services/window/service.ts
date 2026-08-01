/**
 * Window Service
 *
 * Manages application windows lifecycle.
 */

import { app, BrowserWindow } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { createWindowHooks } from './hooks'
import { registerWindowIpc } from './ipc'
import { MainWindowController } from './controllers/main'
import { TrayMenuWindowController } from './controllers/tray-menu'
import { watchWindowShortcuts } from './shortcuts'

const log = createLogger('Window')

export interface WindowsApi {
  getAll(): BrowserWindow[]
}

export class WindowService implements IService {
  readonly id = 'window'
  readonly deps = ['ipc', 'db'] as const satisfies readonly ServiceName[]
  readonly hooks = createWindowHooks()

  readonly mainWindow = new MainWindowController()
  readonly trayMenuWindow = new TrayMenuWindowController()
  readonly windows: WindowsApi = {
    getAll: () => BrowserWindow.getAllWindows()
  }

  private readonly onBeforeQuit = (): void => {
    this.mainWindow.markQuitting()
  }

  private readonly onBrowserWindowCreated = (
    _event: Electron.Event,
    window: BrowserWindow
  ): void => {
    watchWindowShortcuts(window)
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')
    const dbService = container.get('db')

    this.mainWindow.init({ ipcService, dbService })
    registerWindowIpc(this, ipcService)
    app.on('before-quit', this.onBeforeQuit)
    app.on('browser-window-created', this.onBrowserWindowCreated)

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    app.off('before-quit', this.onBeforeQuit)
    app.off('browser-window-created', this.onBrowserWindowCreated)

    this.trayMenuWindow.dispose()
    this.mainWindow.dispose()

    log.info('Disposed')
  }
}
