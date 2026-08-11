import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { PlayerService } from './service'

export function registerPlayerIpc(service: PlayerService, ipc: IpcService): void {
  ipc.handle('player:list-sessions', async () => wrapIpc(async () => service.sessions.list()))

  ipc.handle('player:pause', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.pause(sessionId))
  )

  ipc.handle('player:resume', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.resume(sessionId))
  )

  ipc.handle('player:seek', async (_, sessionId, positionMs) =>
    wrapIpcVoid(() => service.sessions.seek(sessionId, positionMs))
  )

  ipc.handle('player:stop', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.stop(sessionId))
  )
}
