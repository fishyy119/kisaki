import type { IpcService } from '@main/services/ipc'
import type { NotificationService } from './service'

export function registerNotificationIpc(service: NotificationService, ipc: IpcService): void {
  ipc.on('notification:native', (_, options) => {
    service.showNative(options)
  })

  ipc.on('notification:auto', (_, options) => {
    service.showAuto(options)
  })

  ipc.on('notification:action', (_, event) => {
    service.handleAction(event.toastId, event.actionId)
  })

  ipc.on('notification:closed', (_, event) => {
    service.handleClosed(event.toastId)
  })
}
