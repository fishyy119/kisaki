import type {
  CommandDangerLevel,
  CommandExecutionProgressUpdate,
  CommandExecutionSource,
  CommandNotificationTemplate
} from '../../capabilities/commands'
import type { Disposable, MaybePromise, SerializableRecord, SerializableValue } from '../../shared'

export interface CommandContributionExecuteEvent {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  signal: AbortSignal
  reportProgress(progress: CommandExecutionProgressUpdate): void
}

export type CommandContributionExecuteResult = SerializableValue | void

export interface CommandContribution {
  id: string
  title: string
  description?: string
  argsSchema?: SerializableRecord
  defaultArgs?: SerializableRecord
  dangerLevel?: CommandDangerLevel
  cancelable?: boolean
  notification?: CommandNotificationTemplate
  execute(
    args: SerializableRecord,
    event: CommandContributionExecuteEvent
  ): MaybePromise<CommandContributionExecuteResult>
}

export type CommandRegistration = Disposable

export interface CommandRegistrar {
  register(command: CommandContribution): CommandRegistration
}
