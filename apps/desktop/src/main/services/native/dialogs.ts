import { dialog } from 'electron'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { WindowService } from '@main/services/window'

export class NativeDialogs {
  private readonly windowService: WindowService

  constructor(deps: { windowService: WindowService }) {
    this.windowService = deps.windowService
  }

  async showOpenDialog(options?: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    const mainWindow = this.windowService.mainWindow.get()
    if (!mainWindow) {
      throw new Error('No main window found')
    }
    return await dialog.showOpenDialog(mainWindow, options ?? {})
  }
}
