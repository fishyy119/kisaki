/**
 * Tray icon and its menu window.
 *
 * These are one feature: the icon is only an anchor for the menu window, and
 * positioning the menu needs the icon's cursor anchor plus the window's size.
 * Keeping both here means "the tray" has a single owner, so the icon's click
 * behavior and the window's lifecycle cannot drift apart.
 */

import { BrowserWindow, Tray, app, screen } from 'electron'
import { join } from 'node:path'
import { isDev, rendererDevServerUrl } from '@main/env'
import { createLogger } from '@main/log'

const log = createLogger('Window')

export interface TrayApi {
  /** Creates the menu window up front, so a tray click has nothing to wait for. */
  create(): BrowserWindow
  get(): BrowserWindow | null
  /** Resizes the menu to the height the renderer measured. */
  setMenuHeight(height: number): void
}

export interface TrayControllerDeps {
  /** Focuses the main window on a left click; owned by the main controller. */
  focusMainWindow(): void
}

export class TrayController implements TrayApi {
  private window: BrowserWindow | null = null
  private tray: Tray | null = null
  private lastMenuAnchorPoint: Electron.Point | null = null

  init(deps: TrayControllerDeps): void {
    this.tray = new Tray(resolveTrayIconPath())
    this.tray.setToolTip('Kisaki')

    this.tray.on('click', () => {
      try {
        deps.focusMainWindow()
      } catch (error) {
        log.error('Tray click failed.', error)
      }
    })

    this.tray.on('right-click', () => {
      try {
        this.openMenu(screen.getCursorScreenPoint())
      } catch (error) {
        log.error('Open tray menu failed.', error)
      }
    })
  }

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
      this.window = null
    }

    const menuWindow = new BrowserWindow({
      width: 180,
      // https://github.com/electron/electron/issues/32171
      height: 39,
      show: false,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      transparent: false,

      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false
      }
    })
    this.window = menuWindow

    menuWindow.on('blur', () => {
      if (!menuWindow.isDestroyed()) menuWindow.hide()
    })

    menuWindow.on('closed', () => {
      if (this.window === menuWindow) {
        this.window = null
      }
    })

    if (isDev && rendererDevServerUrl) {
      const base = rendererDevServerUrl
      const menuUrl = new URL('tray-menu.html', base.endsWith('/') ? base : `${base}/`).toString()
      menuWindow.loadURL(menuUrl).catch((error) => {
        log.error('Failed to load tray menu window URL:', error)
      })
    } else {
      menuWindow
        .loadFile(join(import.meta.dirname, '../renderer/tray-menu.html'))
        .catch((error) => {
          log.error('Failed to load tray menu window file:', error)
        })
    }

    log.info('Tray menu window created')
    return menuWindow
  }

  get(): BrowserWindow | null {
    return this.window
  }

  setMenuHeight(height: number): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    if (!Number.isFinite(height) || height <= 0) return

    const [currentWidth, currentHeight] = win.getContentSize()
    if (currentHeight === height) return

    win.setContentSize(currentWidth, height, false)
    if (win.isVisible()) {
      this.positionMenu(win, this.lastMenuAnchorPoint ?? screen.getCursorScreenPoint())
    }
  }

  dispose(): void {
    try {
      this.tray?.destroy()
    } finally {
      this.tray = null
      this.lastMenuAnchorPoint = null
    }

    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.destroy()
      } catch {
        // The window may already be gone during shutdown.
      }
    }
    this.window = null
  }

  private openMenu(anchorPoint: Electron.Point): void {
    const win = this.window
    if (!win || win.isDestroyed()) {
      log.warn('Tray menu window not available.')
      return
    }

    this.lastMenuAnchorPoint = { x: Math.round(anchorPoint.x), y: Math.round(anchorPoint.y) }
    this.positionMenu(win, this.lastMenuAnchorPoint)
    win.show()
    win.focus()
  }

  /** Places the menu next to the anchor without leaving the display work area. */
  private positionMenu(win: BrowserWindow, anchor: Electron.Point): void {
    const { workArea } = screen.getDisplayNearestPoint(anchor)
    const [winWidth, winHeight] = win.getSize()

    const workAreaRight = workArea.x + workArea.width
    const workAreaBottom = workArea.y + workArea.height
    let targetX = anchor.x
    let targetY = anchor.y - winHeight

    if (targetX + winWidth > workAreaRight) {
      targetX = anchor.x - winWidth
    }
    if (targetY < workArea.y) {
      targetY = anchor.y
    }
    if (targetY + winHeight > workAreaBottom) {
      targetY = anchor.y - winHeight
    }

    targetX = clamp(targetX, workArea.x, Math.max(workArea.x, workAreaRight - winWidth))
    targetY = clamp(targetY, workArea.y, Math.max(workArea.y, workAreaBottom - winHeight))

    win.setPosition(Math.round(targetX), Math.round(targetY), false)
  }
}

function resolveTrayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
