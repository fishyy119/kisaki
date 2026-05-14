import type { IpcService } from '@main/services/ipc'
import { wrapIpcVoid } from '@main/services/ipc'
import type { LauncherService } from './service'

export function registerLauncherIpc(service: LauncherService, ipc: IpcService): void {
  ipc.handle('launcher:launch-game', async (_, gameId) =>
    wrapIpcVoid(() => service.game.launchGame(gameId))
  )

  ipc.handle('launcher:kill-game', async (_, gameId) =>
    wrapIpcVoid(() => service.game.killGame(gameId))
  )

  ipc.handle('launcher:apply-default-config', async (_, gameId, filePath) =>
    wrapIpcVoid(() => service.applyDefaultConfig(gameId, filePath))
  )
}
