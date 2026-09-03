import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { isDev, isLinux, rendererDevServerUrl } from '@main/env'
import windowStateKeeper from 'electron-window-state'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import { openExternalLink } from '@main/utils/external-url'
import type { MainWindowCloseAction } from '@shared/db/contracts/enums'
import { MAIN_WINDOW_MIN_CONTENT_SIZE } from '@shared/window'
import { applyMinimumSize, lockZoom, resolveDefaultMainWindowSize } from '../geometry'
import type { MainWindowDocumentGoneCause } from '../hooks'
import { watchViewportProbe } from '../shortcuts'

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
  whenRendererReady(timeoutMs: number): Promise<boolean>
}

interface MainWindowControllerDeps {
  ipcService: IpcService
  dbService: DbService
  /** Reports the renderer document ending: navigation, crash, or close. */
  onDocumentGone?: (cause: MainWindowDocumentGoneCause) => void
}

export class MainWindowController implements MainWindowApi {
  private window: BrowserWindow | null = null
  private ipcService: IpcService | null = null
  private mainWindowCloseAction: MainWindowCloseAction = 'exit'
  private isQuitting = false
  private onDocumentGone: ((cause: MainWindowDocumentGoneCause) => void) | undefined
  private rendererReady = false
  private rendererReadyWaiters: Array<(ready: boolean) => void> = []

  init(deps: MainWindowControllerDeps): void {
    this.ipcService = deps.ipcService
    this.onDocumentGone = deps.onDocumentGone
    this.mainWindowCloseAction = deps.dbService.settings.tryGet()?.mainWindowCloseAction ?? 'exit'
  }

  markQuitting(): void {
    this.isQuitting = true
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

    // Frameless: window bounds are content bounds, so the shared content-size
    // contract applies to the window size directly.
    const minimumSize = MAIN_WINDOW_MIN_CONTENT_SIZE
    const defaultSize = resolveDefaultMainWindowSize(minimumSize)

    const mainWindowState = windowStateKeeper({
      defaultWidth: defaultSize.width,
      defaultHeight: defaultSize.height,
      maximize: false,
      fullScreen: false
    })

    const icon = isLinux || isDev ? resolveResourcePath('icon.png') : undefined

    const mainWindow = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      minWidth: minimumSize.width,
      minHeight: minimumSize.height,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      ...(isLinux || isDev ? { icon } : {}),
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.mjs'),
        // Web security stays on: the renderer displays untrusted content
        // (reader-rendered book HTML, scraped text), and all local resources
        // are served through registered privileged custom protocols.
        // `sandbox` stays off because the ESM preload bundle requires a
        // non-sandboxed renderer; context isolation remains enabled by
        // default and the preload exposes only the typed IPC bridge.
        sandbox: false
      }
    })
    this.window = mainWindow

    // A restored state may predate the floor; grow before showing.
    applyMinimumSize(mainWindow, minimumSize)
    lockZoom(mainWindow.webContents)
    watchViewportProbe(mainWindow)

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
      this.rendererReady = false
      this.onDocumentGone?.('closed')
    })

    // A navigation (including reloads) or a crashed renderer ends the
    // document that owned interactive sessions; owners must release them.
    mainWindow.webContents.on('did-navigate', () => {
      this.rendererReady = false
      this.onDocumentGone?.('navigated')
    })
    mainWindow.webContents.on('render-process-gone', () => {
      this.rendererReady = false
      this.onDocumentGone?.('render-process-gone')
    })

    // Script execution precedes the load event, so renderer-side listeners
    // installed during module init are guaranteed to exist by this point.
    mainWindow.webContents.on('did-finish-load', () => {
      this.rendererReady = true
      const waiters = this.rendererReadyWaiters
      this.rendererReadyWaiters = []
      for (const resolve of waiters) {
        resolve(true)
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

  /**
   * Resolves true once the renderer document has finished loading (and can
   * therefore receive IPC events), or false when the timeout elapses first.
   * Reloads and crashes reset readiness until the next successful load.
   */
  whenRendererReady(timeoutMs: number): Promise<boolean> {
    if (this.rendererReady) {
      return Promise.resolve(true)
    }

    return new Promise<boolean>((resolve) => {
      const waiter = (ready: boolean): void => {
        clearTimeout(timer)
        resolve(ready)
      }
      const timer = setTimeout(() => {
        this.rendererReadyWaiters = this.rendererReadyWaiters.filter((entry) => entry !== waiter)
        resolve(false)
      }, timeoutMs)
      this.rendererReadyWaiters.push(waiter)
    })
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
