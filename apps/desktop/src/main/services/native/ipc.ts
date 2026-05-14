import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { NativeService } from './service'

export function registerNativeIpc(service: NativeService, ipc: IpcService): void {
  ipc.handle('native:open-dialog', async (_, options) =>
    wrapIpc(() => service.showOpenDialog(options))
  )

  ipc.handle('native:open-path', async (_, input) => wrapIpcVoid(() => service.openPath(input)))

  ipc.handle('native:open-external', async (_, url) => wrapIpcVoid(() => service.openExternal(url)))

  ipc.handle('native:get-auto-launch', async () => wrapIpc(() => service.getAutoLaunchEnabled()))

  ipc.handle('native:set-auto-launch', async (_, enabled) =>
    wrapIpcVoid(() => service.setAutoLaunchEnabled(enabled))
  )

  ipc.on('native:set-tray-menu-height', (_e, height) => {
    service.updateTrayMenuHeight(height)
  })
}
