/**
 * Window Service
 *
 * Manages application windows lifecycle and the window-level appearance
 * policy: the interface scale (owned here - the single writer of
 * `settings.ui_scale`, stepped by keyboard in every window and set from the
 * settings surface), and the absence of a default application menu.
 */

import { app, BrowserWindow } from 'electron'
import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import { settings } from '@shared/db/schema'
import { parseUiScale, stepUiScale, UI_SCALE_DEFAULT, type UiScale } from '@shared/window'
import { createWindowHooks } from './hooks'
import { registerWindowIpc } from './ipc'
import { MainWindowController } from './controllers/main'
import { TrayController } from './controllers/tray'
import { installApplicationMenu } from './menu'
import { watchInterfaceScaleShortcuts, watchWindowShortcuts } from './shortcuts'

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

  private uiScale: UiScale = UI_SCALE_DEFAULT
  private ipcService: IpcService | null = null
  private dbService: DbService | null = null

  /** Interface scale in effect; every window mirrors it into its root font size. */
  get interfaceScale(): UiScale {
    return this.uiScale
  }

  private readonly onBeforeQuit = (): void => {
    this.mainWindow.markQuitting()
  }

  /** Single-instance UX: a second launch surfaces the existing window. */
  private readonly onSecondInstance = (): void => {
    this.mainWindow.focus()
  }

  private readonly onBrowserWindowCreated = (
    _event: Electron.Event,
    window: BrowserWindow
  ): void => {
    watchWindowShortcuts(window)
    watchInterfaceScaleShortcuts(window, (direction) => {
      this.setInterfaceScale(
        direction === 0 ? UI_SCALE_DEFAULT : stepUiScale(this.uiScale, direction)
      )
    })
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')
    const dbService = container.get('db')
    this.ipcService = ipcService
    this.dbService = dbService

    installApplicationMenu()

    this.uiScale = parseUiScale(dbService.settings.tryGet()?.uiScale)

    this.mainWindow.init({
      ipcService,
      dbService,
      onDocumentGone: (cause) => this.hooks.mainWindowDocumentGone.dispatch({ cause })
    })
    this.tray.init({ focusMainWindow: () => this.mainWindow.focus() })
    registerWindowIpc(this, ipcService)

    app.on('before-quit', this.onBeforeQuit)
    app.on('browser-window-created', this.onBrowserWindowCreated)
    app.on('second-instance', this.onSecondInstance)

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    app.off('before-quit', this.onBeforeQuit)
    app.off('browser-window-created', this.onBrowserWindowCreated)
    app.off('second-instance', this.onSecondInstance)

    this.tray.dispose()
    this.mainWindow.dispose()

    log.info('Disposed')
  }

  /** Persist a new interface scale and push it to every window. */
  setInterfaceScale(value: UiScale): void {
    const scale = parseUiScale(value)
    if (this.uiScale === scale) return

    this.dbService?.client.update(settings).set({ uiScale: scale }).run()
    this.uiScale = scale
    this.ipcService?.send('window:interface-scale-changed', scale)
    log.info('Updated interface scale:', scale)
  }
}
