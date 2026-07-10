import { BrowserWindow } from 'electron'
import { join } from 'path'
import { isDev, rendererDevServerUrl } from '@main/env'
import { createLogger } from '@main/log'

const log = createLogger('Window')

export interface TrayMenuWindowApi {
  create(): BrowserWindow
  get(): BrowserWindow | null
}

export class TrayMenuWindowController implements TrayMenuWindowApi {
  private window: BrowserWindow | null = null

  dispose(): void {
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
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
      this.window = null
    }

    const trayMenuWindow = new BrowserWindow({
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
    this.window = trayMenuWindow

    trayMenuWindow.on('blur', () => {
      if (!trayMenuWindow.isDestroyed()) trayMenuWindow.hide()
    })

    trayMenuWindow.on('closed', () => {
      if (this.window === trayMenuWindow) {
        this.window = null
      }
    })

    if (isDev && rendererDevServerUrl) {
      const base = rendererDevServerUrl
      const trayMenuUrl = new URL(
        'tray-menu.html',
        base.endsWith('/') ? base : `${base}/`
      ).toString()
      trayMenuWindow.loadURL(trayMenuUrl).catch((error) => {
        log.error('Failed to load tray menu window URL:', error)
      })
    } else {
      trayMenuWindow
        .loadFile(join(import.meta.dirname, '../renderer/tray-menu.html'))
        .catch((error) => {
          log.error('Failed to load tray menu window file:', error)
        })
    }

    log.info('Tray menu window created')
    return trayMenuWindow
  }

  get(): BrowserWindow | null {
    return this.window
  }
}
