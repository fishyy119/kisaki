import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { EventService } from '@main/services/event'
import type { IpcService } from '@main/services/ipc'
import type { CommandExecutionProgress } from '@shared/command'
import { CommandExecutions } from './executions'
import { registerCommandIpc } from './ipc'
import { CommandRegistry } from './registry'

const log = createLogger('Command')

export class CommandService implements IService {
  readonly id = 'command'
  readonly deps = ['ipc', 'event'] as const satisfies readonly ServiceName[]

  readonly registry: CommandRegistry
  readonly executions: CommandExecutions
  private event?: EventService
  private ipc?: IpcService

  constructor() {
    this.registry = new CommandRegistry({
      isRunning: (commandId) => this.executions.isRunning(commandId)
    })
    this.executions = new CommandExecutions({
      getCommand: (commandId) => this.registry.getRegisteredCommand(commandId),
      onProgress: (progress) => this.emitProgress(progress)
    })
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.event = container.get('event')
    this.ipc = container.get('ipc')
    registerCommandIpc(this, this.ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.executions.dispose()
    this.registry.clear()
    this.event = undefined
    this.ipc = undefined
    log.info('Disposed')
  }

  private emitProgress(progress: CommandExecutionProgress): void {
    this.ipc?.send('command:progress', progress)
    this.event?.bus.emit('command:progress', { local: true }, progress)
  }
}
