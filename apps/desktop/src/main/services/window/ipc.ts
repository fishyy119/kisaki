import type { IpcService } from '@main/services/ipc'
import { wrapIpcVoid } from '@main/services/ipc'
import type { WindowService } from './service'

export function registerWindowIpc(service: WindowService, ipc: IpcService): void {
  ipc.on('window:set-main-window-close-action', (_e, action) => {
    service.mainWindow.setCloseAction(action)
  })

  ipc.handle('window:minimize-main-window', () => wrapIpcVoid(() => service.mainWindow.minimize()))

  ipc.handle('window:toggle-main-window-maximize', () =>
    wrapIpcVoid(() => service.mainWindow.toggleMaximize())
  )

  ipc.handle('window:close-main-window', () =>
    wrapIpcVoid(() => service.mainWindow.closeByConfiguredAction())
  )
}
