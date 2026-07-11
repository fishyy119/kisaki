import { app, BrowserWindow, screen, Tray } from 'electron'
import { join } from 'node:path'
import { createLogger } from '@main/log'
import type { WindowService } from '@main/services/window'

const log = createLogger('Native')

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getTrayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico')
}

export class NativeTray {
  private readonly windowService: WindowService

  private tray: Tray | null = null
  private lastMenuAnchorPoint: Electron.Point | null = null

  constructor(deps: { windowService: WindowService }) {
    this.windowService = deps.windowService
  }

  init(): void {
    const iconPath = getTrayIconPath()
    this.tray = new Tray(iconPath)
    this.tray.setToolTip('Kisaki')

    this.tray.on('click', () => {
      try {
        this.windowService.mainWindow.focus()
      } catch (error) {
        log.error('Tray click failed:', error)
      }
    })

    this.tray.on('right-click', (_event, _bounds) => {
      try {
        this.openTrayMenuWindow(screen.getCursorScreenPoint())
      } catch (error) {
        log.error('Open tray menu failed:', error)
      }
    })

    log.info('Initialized')
  }

  dispose(): void {
    try {
      this.tray?.destroy()
    } finally {
      this.tray = null
      this.lastMenuAnchorPoint = null
    }
    log.info('Disposed')
  }

  private getMenuAnchorPoint(): Electron.Point {
    return this.lastMenuAnchorPoint ?? screen.getCursorScreenPoint()
  }

  private positionTrayMenuWindow(win: BrowserWindow, anchor: Electron.Point): void {
    const display = screen.getDisplayNearestPoint(anchor)
    const workArea = display.workArea

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

    const minX = workArea.x
    const minY = workArea.y
    const maxX = Math.max(workArea.x, workAreaRight - winWidth)
    const maxY = Math.max(workArea.y, workAreaBottom - winHeight)

    targetX = clamp(targetX, minX, maxX)
    targetY = clamp(targetY, minY, maxY)

    win.setPosition(Math.round(targetX), Math.round(targetY), false)
  }

  private openTrayMenuWindow(anchorPoint: Electron.Point): void {
    const win = this.windowService.trayMenuWindow.get()
    if (!win) {
      log.warn('Tray menu window not available')
      return
    }

    this.lastMenuAnchorPoint = { x: Math.round(anchorPoint.x), y: Math.round(anchorPoint.y) }

    this.positionTrayMenuWindow(win, this.lastMenuAnchorPoint)
    win.show()
    win.focus()
  }

  updateMenuHeight(height: number): void {
    const win = this.windowService.trayMenuWindow.get()
    if (!win) return
    if (!Number.isFinite(height) || height <= 0) return

    const [currentWidth, currentHeight] = win.getContentSize()
    if (currentHeight === height) return

    win.setContentSize(currentWidth, height, false)
    if (win.isVisible()) {
      this.positionTrayMenuWindow(win, this.getMenuAnchorPoint())
    }
  }
}
