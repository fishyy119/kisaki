import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { MonitorService } from './service'

export function registerMonitorIpc(service: MonitorService, ipc: IpcService): void {
  ipc.handle('monitor:start-game', async (_, gameId) =>
    wrapIpcVoid(() => service.game.startMonitoring(gameId))
  )

  ipc.handle('monitor:stop-game', async (_, gameId) =>
    wrapIpcVoid(() => service.game.stopMonitoring(gameId))
  )

  ipc.handle('monitor:get-game-status', async (_, gameId) =>
    wrapIpc(() => service.getGameStatus(gameId))
  )

  ipc.handle('monitor:compute-effective-path', async (_, config) =>
    wrapIpc(() => service.computeEffectivePath(config))
  )
}
