import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { EventBus } from './bus'
import { registerEventIpc } from './ipc'

const log = createLogger('Event')

export class EventService implements IService {
  readonly id = 'event'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]
  readonly bus = new EventBus({
    forwardToRenderer: (event, args) => {
      this.ipcService?.send('event:forward', event, args)
    }
  })

  private ipcService: IpcService | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')

    this.ipcService = ipc
    registerEventIpc(this, ipc)
    this.bus.enableForwarding()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.bus.dispose()
    this.ipcService = null
  }
}
