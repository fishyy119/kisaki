import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { isDev, isLinux, rendererDevServerUrl } from '@main/env'
import windowStateKeeper from 'electron-window-state'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import { openExternalLink } from '@main/utils/external-url'
import type { MainWindowCloseAction } from '@shared/db/contracts/enums'

const log = createLogger('Window')

export interface MainWindowApi {
  create(): BrowserWindow
  get(): BrowserWindow | null
  focus(): void
  isFocused(): boolean
  setCloseAction(action: MainWindowCloseAction): void
  minimize(): void
  toggleMaximize(): void
  closeByConfiguredAction(): void
}

interface MainWindowControllerDeps {
  ipcService: IpcService
  dbService: DbService
}

export class MainWindowController implements MainWindowApi {
  private window: BrowserWindow | null = null
  private ipcService: IpcService | null = null
  private mainWindowCloseAction: MainWindowCloseAction = 'exit'
  private isQuitting = false

  init(deps: MainWindowControllerDeps): void {
    this.ipcService = deps.ipcService
    this.mainWindowCloseAction = this.loadMainWindowCloseActionFromDb(deps.dbService)
  }

  markQuitting(): void {
    this.isQuitting = true
  }

  private loadMainWindowCloseActionFromDb(dbService: DbService): MainWindowCloseAction {
    return dbService.settings.tryGet()?.mainWindowCloseAction ?? 'exit'
  }

  setCloseAction(action: MainWindowCloseAction): void {
    if (action !== 'exit' && action !== 'tray') {
      log.warn('Ignored invalid main window close action:', action)
      return
    }

    if (this.mainWindowCloseAction === action) return
    this.mainWindowCloseAction = action
    log.info('Updated main window close action:', action)
  }

  minimize(): void {
    const mainWindow = this.require()
    mainWindow.minimize()
  }

  toggleMaximize(): void {
    const mainWindow = this.require()
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }

  closeByConfiguredAction(): void {
    this.require()
    this.applyMainWindowCloseAction(this.mainWindowCloseAction)
  }

  private applyMainWindowCloseAction(action: MainWindowCloseAction, event?: Electron.Event): void {
    const mainWindow = this.get()
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (this.isQuitting) return

    if (action === 'tray') {
      event?.preventDefault()
      mainWindow.hide()
      return
    }

    // action === 'exit'
    event?.preventDefault()
    setImmediate(() => app.quit())
  }

  dispose(): void {
    this.markQuitting()

    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.destroy()
      } catch {
        // ignore
      }
    }
    this.window = null
  }

  create(): BrowserWindow {
    const ipcService = this.requireIpcService()

    const mainWindowState = windowStateKeeper({
      defaultWidth: 1400,
      defaultHeight: 850,
      maximize: false,
      fullScreen: false
    })

    const icon = isLinux || isDev ? resolveResourcePath('icon.png') : undefined

    const mainWindow = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      ...(isLinux || isDev ? { icon } : {}),
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false
      }
    })
    this.window = mainWindow

    mainWindowState.manage(mainWindow)

    mainWindow.on('close', (event) => {
      this.applyMainWindowCloseAction(this.mainWindowCloseAction, event)
    })

    mainWindow.on('ready-to-show', () => {
      if (!mainWindow.isDestroyed()) mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      void openExternalLink(details.url).catch((error) => {
        log.warn('Blocked external navigation:', error)
      })
      return { action: 'deny' }
    })

    mainWindow.on('maximize', () => {
      ipcService.send('native:main-window-maximized')
    })

    mainWindow.on('unmaximize', () => {
      ipcService.send('native:main-window-unmaximized')
    })

    mainWindow.on('closed', () => {
      if (this.window === mainWindow) {
        this.window = null
      }
    })

    if (isDev && rendererDevServerUrl) {
      const base = rendererDevServerUrl
      const mainUrl = new URL('main.html', base.endsWith('/') ? base : `${base}/`).toString()
      mainWindow.loadURL(mainUrl)
    } else {
      mainWindow.loadFile(join(import.meta.dirname, '../renderer/main.html'))
    }

    log.info('Main window created')
    return mainWindow
  }

  get(): BrowserWindow | null {
    return this.window
  }

  focus(): void {
    const mainWindow = this.get()
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  }

  isFocused(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isFocused()
  }

  private require(): BrowserWindow {
    const mainWindow = this.get()
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Window not available')
    }
    return mainWindow
  }

  private requireIpcService(): IpcService {
    if (!this.ipcService) {
      throw new Error('Window service not initialized')
    }
    return this.ipcService
  }
}

function resolveResourcePath(fileName: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'resources', fileName)
  }

  return join(app.getAppPath(), 'resources', fileName)
}
