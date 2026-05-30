import type { CommandDangerLevel, CommandInvocationSource } from '../../capabilities/commands'
import type { Disposable, MaybePromise, SerializableRecord, SerializableValue } from '../../shared'

export interface CommandContributionExecuteEvent {
  commandId: string
  source: CommandInvocationSource
}

export type CommandContributionExecuteResult = SerializableValue | void

export interface CommandContribution {
  id: string
  title: string
  description?: string
  argsSchema?: SerializableRecord
  defaultArgs?: SerializableRecord
  dangerLevel?: CommandDangerLevel
  execute(
    args: SerializableRecord,
    event: CommandContributionExecuteEvent
  ): MaybePromise<CommandContributionExecuteResult>
}

export type CommandRegistration = Disposable

export interface CommandRegistrar {
  register(command: CommandContribution): CommandRegistration
}
