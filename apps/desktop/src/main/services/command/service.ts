import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { EventService } from '@main/services/event'
import type { IpcService } from '@main/services/ipc'
import type { NotifyService } from '@main/services/notify'
import type {
  CommandExecutionProgress,
  CommandExecutionResult,
  CommandExecutionStartResult
} from '@shared/command'
import { CommandExecutions } from './executions'
import { registerCommandIpc } from './ipc'
import { CommandNotificationCoordinator } from './notifications'
import { CommandRegistry } from './registry'

const log = createLogger('Command')

export class CommandService implements IService {
  readonly id = 'command'
  readonly deps = ['ipc', 'event', 'notify'] as const satisfies readonly ServiceName[]

  readonly registry: CommandRegistry
  readonly executions: CommandExecutions
  private event?: EventService
  private ipc?: IpcService
  private notifications?: CommandNotificationCoordinator

  constructor() {
    this.registry = new CommandRegistry({
      getState: (commandId) => this.executions.getCommandState(commandId)
    })
    this.executions = new CommandExecutions({
      getCommand: (commandId) => this.registry.getRegisteredCommand(commandId),
      onStart: (started, command, request) => {
        this.emitStarted(started)
        this.notifications?.start(started, command, request)
      },
      onProgress: (progress) => this.emitProgress(progress),
      onFinish: (result) => this.emitFinished(result)
    })
  }

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.event = container.get('event')
    this.ipc = container.get('ipc')
    this.notifications = this.createNotificationCoordinator(container.get('notify'))
    registerCommandIpc(this, this.ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.executions.dispose()
    this.notifications?.dispose()
    this.registry.clear()
    this.event = undefined
    this.ipc = undefined
    this.notifications = undefined
    log.info('Disposed')
  }

  private emitProgress(progress: CommandExecutionProgress): void {
    this.ipc?.send('command:progress', progress)
    this.event?.bus.emit('command.progressed', { local: true }, progress)
    this.notifications?.reportProgress(progress)
  }

  private emitStarted(started: CommandExecutionStartResult): void {
    this.ipc?.send('command:started', started)
    this.event?.bus.emit('command.started', { local: true }, started)
  }

  private emitFinished(result: CommandExecutionResult): void {
    this.ipc?.send('command:finished', result)
    this.event?.bus.emit('command.finished', { local: true }, result)
    this.notifications?.finish(result)
  }

  private createNotificationCoordinator(notify: NotifyService): CommandNotificationCoordinator {
    return new CommandNotificationCoordinator({
      notify,
      cancelExecution: (executionId) => this.executions.cancel(executionId)
    })
  }
}
