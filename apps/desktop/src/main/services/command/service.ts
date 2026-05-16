import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { CommandExecutions } from './executions'
import { registerCommandIpc } from './ipc'
import { CommandRegistry } from './registry'

const log = createLogger('Command')

export class CommandService implements IService {
  readonly id = 'command'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]

  readonly registry: CommandRegistry
  readonly executions: CommandExecutions

  constructor() {
    this.registry = new CommandRegistry({
      isRunning: (commandId) => this.executions.isRunning(commandId)
    })
    this.executions = new CommandExecutions({
      getCommand: (commandId) => this.registry.getRegisteredCommand(commandId)
    })
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    registerCommandIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.executions.dispose()
    this.registry.clear()
    log.info('Disposed')
  }
}
