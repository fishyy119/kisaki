import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { UpdaterService } from './service'

export function registerUpdaterIpc(service: UpdaterService, ipc: IpcService): void {
  ipc.handle('updater:get-state', async () => wrapIpc(() => service.updates.getState()))

  ipc.handle('updater:get-changelog', async (_, version) =>
    wrapIpc(() => service.changelog.get(version))
  )

  ipc.handle('updater:check-for-updates', async () =>
    wrapIpc(() => service.updates.startCheckForUpdates())
  )

  ipc.handle('updater:download-update', async () =>
    wrapIpc(() => service.updates.startDownloadUpdate())
  )

  ipc.handle('updater:reload-settings', async () => wrapIpcVoid(() => service.settings.reload()))

  ipc.handle('updater:quit-and-install', async () =>
    wrapIpcVoid(() => service.updates.quitAndInstall())
  )
}
