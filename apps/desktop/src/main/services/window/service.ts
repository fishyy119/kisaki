/**
 * Window Service
 *
 * Manages application windows lifecycle.
 */

import { app, BrowserWindow } from 'electron'
import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { createWindowHooks } from './hooks'
import { registerWindowIpc } from './ipc'
import { MainWindowController } from './controllers/main'
import { TrayController } from './controllers/tray'
import { watchWindowShortcuts } from './shortcuts'

const log = createLogger('Window')

export interface WindowsApi {
  getAll(): BrowserWindow[]
}

export class WindowService implements INonDomainService<'window'> {
  readonly id = 'window'
  readonly deps = ['ipc', 'db'] as const
  readonly hooks = createWindowHooks()

  readonly mainWindow = new MainWindowController()
  readonly tray = new TrayController()
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
    this.tray.init({ focusMainWindow: () => this.mainWindow.focus() })
    registerWindowIpc(this, ipcService)
    app.on('before-quit', this.onBeforeQuit)
    app.on('browser-window-created', this.onBrowserWindowCreated)

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    app.off('before-quit', this.onBeforeQuit)
    app.off('browser-window-created', this.onBrowserWindowCreated)

    this.tray.dispose()
    this.mainWindow.dispose()

    log.info('Disposed')
  }
}
