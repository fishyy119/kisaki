import type { IpcService } from '@main/services/ipc'
import type { NotifyService } from './service'

export function registerNotifyIpc(service: NotifyService, ipc: IpcService): void {
  ipc.on('notify:native', (_, options) => {
    service.showNative(options)
  })

  ipc.on('notify:auto', (_, options) => {
    service.showAuto(options)
  })

  ipc.on('notify:action', (_, event) => {
    service.handleAction(event.toastId, event.actionId)
  })
}
