/**
 * Native Service
 *
 * Handles native desktop integration IPC operations (dialogs, shell, etc.).
 */

import { app, dialog, shell, OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { createLogger } from '@main/log'
import { stat } from 'fs/promises'
import { basename, dirname } from 'path'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { WindowService } from '@main/services/window'
import { openExternalLink } from '@main/utils'
import { NativeTray } from './tray'
import { registerNativeIpc } from './ipc'

const log = createLogger('Native')

export class NativeService implements IService {
  readonly id = 'native'
  readonly deps = ['ipc', 'window'] as const satisfies readonly ServiceName[]

  private windowService!: WindowService
  private tray: NativeTray | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipcService = container.get('ipc')
    this.windowService = container.get('window')
    registerNativeIpc(this, ipcService)

    this.tray = new NativeTray({ windowService: this.windowService })
    this.tray.init()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    try {
      this.tray?.dispose()
    } finally {
      this.tray = null
    }
    log.info('Disposed')
  }

  getAutoLaunchEnabled(): boolean {
    return !!app.getLoginItemSettings().openAtLogin
  }

  setAutoLaunchEnabled(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: []
    })
  }

  updateTrayMenuHeight(height: number): void {
    this.tray?.updateTrayMenuHeight(height)
  }

  /**
   * Show open dialog with main window
   */
  async showOpenDialog(options?: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    const mainWindow = this.windowService.getMainWindow()
    if (!mainWindow) {
      throw new Error('No main window found')
    }
    return await dialog.showOpenDialog(mainWindow, options || {})
  }

  /**
   * Open a file or directory with the default system application
   */
  async openPath(
    input:
      | string
      | {
          path: string
          ensure?: 'auto' | 'folder' | 'file'
        }
  ): Promise<void> {
    const config =
      typeof input === 'string'
        ? { path: input, ensure: 'auto' as const }
        : { path: input.path, ensure: input.ensure ?? ('auto' as const) }

    let targetPath = config.path

    if (config.ensure === 'folder') {
      targetPath = await this.ensureFolderPath(targetPath)
    } else if (config.ensure === 'file') {
      // If user passed a folder but wants a file, keep as-is and let the OS handle errors.
      // (We mainly need `ensure: 'folder'` to avoid launching executables.)
    }

    try {
      const errorMessage = await shell.openPath(targetPath)
      if (errorMessage) {
        throw new Error('Shell openPath failed.')
      }
    } catch (error) {
      log.error('Failed to open native path.', error, {
        targetName: basename(targetPath),
        ensure: config.ensure
      })
      throw new Error('Failed to open native path.')
    }
  }

  async openExternal(url: string): Promise<void> {
    await openExternalLink(url)
  }

  private async ensureFolderPath(path: string): Promise<string> {
    try {
      const info = await stat(path)
      if (info.isDirectory()) return path
      if (info.isFile()) return dirname(path)
      return dirname(path)
    } catch {
      const candidate = dirname(path)
      try {
        const info = await stat(candidate)
        if (info.isDirectory()) return candidate
      } catch {
        // ignore
      }
      return candidate
    }
  }
}
