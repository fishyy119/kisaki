import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { UpdaterService } from './service'

export function registerUpdaterIpc(service: UpdaterService, ipc: IpcService): void {
  ipc.handle('updater:get-state', async () => wrapIpc(() => service.getState()))

  ipc.handle('updater:get-changelog', async (_, version) =>
    wrapIpc(() => service.getChangelog(version))
  )

  ipc.handle('updater:check-for-updates', async () => wrapIpcVoid(() => service.checkForUpdates()))

  ipc.handle('updater:download-update', async () => wrapIpcVoid(() => service.downloadUpdate()))

  ipc.handle('updater:reload-settings', async () =>
    wrapIpcVoid(() => service.reloadUpdaterSettings())
  )

  ipc.handle('updater:quit-and-install', async () => wrapIpcVoid(() => service.quitAndInstall()))
}
