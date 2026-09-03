import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { WindowService } from './service'

export function registerWindowIpc(service: WindowService, ipc: IpcService): void {
  ipc.on('window:set-main-window-close-action', (_e, action) => {
    service.mainWindow.setCloseAction(action)
  })

  ipc.on('window:set-tray-menu-height', (_e, height) => {
    service.tray.setMenuHeight(height)
  })

  ipc.on('app:theme-changed', (_e, theme) => {
    service.hooks.themeChanged.dispatch(theme)
  })

  ipc.handle('window:minimize-main-window', () => wrapIpcVoid(() => service.mainWindow.minimize()))

  ipc.handle('window:toggle-main-window-maximize', () =>
    wrapIpcVoid(() => service.mainWindow.toggleMaximize())
  )

  ipc.handle('window:close-main-window', () =>
    wrapIpcVoid(() => service.mainWindow.closeByConfiguredAction())
  )

  ipc.handle('window:get-interface-scale', () => wrapIpc(() => service.interfaceScale))

  ipc.handle('window:set-interface-scale', (_e, scale) =>
    wrapIpcVoid(() => service.setInterfaceScale(scale))
  )
}
