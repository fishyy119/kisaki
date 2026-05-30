import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { AutomationService } from './service'

export function registerAutomationIpc(service: AutomationService, ipc: IpcService): void {
  ipc.handle('automation:list', async () => wrapIpc(() => service.store.list()))

  ipc.handle('automation:list-running', async () =>
    wrapIpc(() => service.runner.listRunningAutomationIds())
  )

  ipc.handle('automation:get', async (_, automationId) =>
    wrapIpc(() => service.store.get(automationId))
  )

  ipc.handle('automation:create', async (_, input) => wrapIpc(() => service.store.create(input)))

  ipc.handle('automation:update', async (_, automationId, patch) =>
    wrapIpc(() => service.store.update(automationId, patch))
  )

  ipc.handle('automation:set-enabled', async (_, automationId, enabled) =>
    wrapIpc(() => service.store.setEnabled(automationId, enabled))
  )

  ipc.handle('automation:delete', async (_, automationId) =>
    wrapIpcVoid(() => service.store.delete(automationId))
  )

  ipc.handle('automation:run', async (_, automationId) =>
    wrapIpc(() => service.runner.runNow(automationId))
  )

  ipc.handle('automation:cancel', async (_, automationId) =>
    wrapIpc(() => service.runner.cancel(automationId))
  )
}
