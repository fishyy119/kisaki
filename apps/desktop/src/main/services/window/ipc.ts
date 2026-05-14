import type { IpcService } from '@main/services/ipc'
import { wrapIpcVoid } from '@main/services/ipc'
import type { WindowService } from './service'

export function registerWindowIpc(service: WindowService, ipc: IpcService): void {
  ipc.on('window:set-main-window-close-action', (_e, action) => {
    service.setMainWindowCloseAction(action)
  })

  ipc.handle('window:minimize-main-window', () => wrapIpcVoid(() => service.minimizeMainWindow()))

  ipc.handle('window:toggle-main-window-maximize', () =>
    wrapIpcVoid(() => service.toggleMainWindowMaximize())
  )

  ipc.handle('window:close-main-window', () =>
    wrapIpcVoid(() => service.closeMainWindowByConfiguredAction())
  )
}
