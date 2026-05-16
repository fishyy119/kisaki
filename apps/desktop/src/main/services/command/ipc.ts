import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { CommandService } from './service'

export function registerCommandIpc(service: CommandService, ipc: IpcService): void {
  ipc.handle('command:list', async () => wrapIpc(() => service.registry.list()))

  ipc.handle('command:start', async (_, request) =>
    wrapIpc(() => service.executions.start(request))
  )

  ipc.handle('command:wait', async (_, executionId) =>
    wrapIpc(() => service.executions.wait(executionId))
  )

  ipc.handle('command:execute', async (_, request) =>
    wrapIpc(() => service.executions.execute(request))
  )

  ipc.handle('command:cancel', async (_, executionId) =>
    wrapIpc(() => service.executions.cancel(executionId))
  )
}
