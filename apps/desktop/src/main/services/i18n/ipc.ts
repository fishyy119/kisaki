import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { I18nService } from './service'

export function registerI18nIpc(service: I18nService, ipc: IpcService): void {
  ipc.handle('i18n:get-state', async () => wrapIpc(() => service.getState()))

  ipc.handle('i18n:set-preference', async (_, preference) =>
    wrapIpcVoid(() => service.setPreference(preference))
  )
}
