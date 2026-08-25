import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { VideoService } from './service'

export function registerVideoIpc(service: VideoService, ipc: IpcService): void {
  ipc.handle('video:list-sessions', async () => wrapIpc(async () => service.sessions.list()))

  ipc.handle('video:pause', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.pause(sessionId))
  )

  ipc.handle('video:resume', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.resume(sessionId))
  )

  ipc.handle('video:seek', async (_, sessionId, positionMs) =>
    wrapIpcVoid(() => service.sessions.seek(sessionId, positionMs))
  )

  ipc.handle('video:stop', async (_, sessionId) =>
    wrapIpcVoid(() => service.sessions.stop(sessionId))
  )
}
