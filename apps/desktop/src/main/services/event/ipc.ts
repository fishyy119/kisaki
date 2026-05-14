import type { IpcService } from '@main/services/ipc'
import type { AppEvents } from '@shared/events'
import type { EventService } from './service'

export function registerEventIpc(service: EventService, ipc: IpcService): void {
  ipc.on('event:forward', (_, event: keyof AppEvents, args: unknown[]) => {
    service.emit(event, { local: true }, ...(args as [any]))
  })
}
