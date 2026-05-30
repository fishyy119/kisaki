import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { CommandService } from './service'

export function registerCommandIpc(service: CommandService, ipc: IpcService): void {
  ipc.handle('command:list', async () => wrapIpc(() => service.registry.list()))

  ipc.handle('command:get', async (_, commandId) => wrapIpc(() => service.registry.get(commandId)))

  ipc.handle('command:invoke', async (_, request) => wrapIpc(() => service.invoke(request)))
}
