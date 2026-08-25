import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type {
  CommandInvocationRequest,
  CommandInvocationResult,
  CommandInvocationSource
} from '@shared/command'
import { registerCommandIpc } from './ipc'
import { CommandRegistry } from './registry'

const log = createLogger('Command')

export class CommandService implements IService<'command'> {
  readonly id = 'command'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]

  readonly registry: CommandRegistry
  private ipc?: IpcService

  constructor() {
    this.registry = new CommandRegistry()
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipc = container.get('ipc')
    registerCommandIpc(this, this.ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.registry.clear()
    this.ipc = undefined
    log.info('Disposed')
  }

  async invoke(request: CommandInvocationRequest): Promise<CommandInvocationResult> {
    const command = this.registry.getRegisteredCommand(request.commandId)
    if (!command) {
      throw new Error(`Command "${request.commandId}" is not registered.`)
    }

    const output = await command.execute(
      {
        ...(command.descriptor.defaultArgs ?? {}),
        ...(request.args ?? {})
      },
      {
        commandId: command.descriptor.id,
        source: request.source ?? ({ type: 'user' } satisfies CommandInvocationSource)
      }
    )

    return {
      commandId: command.descriptor.id,
      output
    }
  }
}
