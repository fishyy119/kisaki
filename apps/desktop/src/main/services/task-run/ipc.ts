import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { TaskRunService } from './service'

export function registerTaskRunIpc(service: TaskRunService, ipc: IpcService): void {
  ipc.handle('task-run:list-active', async (_, query) => wrapIpc(() => service.runs.list(query)))

  ipc.handle('task-run:list-history', async (_, query) =>
    wrapIpc(() => service.history.list(query))
  )

  ipc.handle('task-run:get-active', async (_, runId) => wrapIpc(() => service.runs.get(runId)))

  ipc.handle('task-run:get-history', async (_, runId) => wrapIpc(() => service.history.get(runId)))

  ipc.handle('task-run:wait', async (_, runId) => wrapIpc(() => service.runs.wait(runId)))

  ipc.handle('task-run:cancel', async (_, runId) => wrapIpc(() => service.runs.cancel(runId)))

  ipc.handle('task-run:pause', async (_, runId) => wrapIpc(() => service.runs.pause(runId)))

  ipc.handle('task-run:resume', async (_, runId) => wrapIpc(() => service.runs.resume(runId)))

  ipc.handle('task-run:delete-history', async (_, runId) =>
    wrapIpcVoid(() => service.history.delete(runId))
  )

  ipc.handle('task-run:clear-completed', async () =>
    wrapIpcVoid(() => service.history.clearCompleted())
  )
}
