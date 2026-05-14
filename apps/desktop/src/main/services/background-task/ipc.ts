import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { BackgroundTaskService } from './service'

export function registerBackgroundTaskIpc(service: BackgroundTaskService, ipc: IpcService): void {
  ipc.handle('background-task:list', async () => wrapIpc(() => service.list()))

  ipc.handle('background-task:get', async (_, taskId) => wrapIpc(() => service.get(taskId)))

  ipc.handle('background-task:create', async (_, input) => wrapIpc(() => service.create(input)))

  ipc.handle('background-task:update', async (_, taskId, patch) =>
    wrapIpc(() => service.update(taskId, patch))
  )

  ipc.handle('background-task:set-enabled', async (_, taskId, enabled) =>
    wrapIpc(() => service.setEnabled(taskId, enabled))
  )

  ipc.handle('background-task:delete', async (_, taskId) =>
    wrapIpcVoid(() => service.delete(taskId))
  )

  ipc.handle('background-task:run', async (_, taskId) => wrapIpc(() => service.runNow(taskId)))

  ipc.handle('background-task:cancel', async (_, taskId) => wrapIpc(() => service.cancel(taskId)))
}
