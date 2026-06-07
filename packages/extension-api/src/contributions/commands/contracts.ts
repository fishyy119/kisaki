import type { CommandDangerLevel, CommandInvocationSource } from '../../capabilities/commands'
import type { Disposable, MaybePromise, JsonObject, JsonValue } from '../../shared'

export interface CommandContributionExecuteEvent {
  commandId: string
  source: CommandInvocationSource
}

export type CommandContributionExecuteResult = JsonValue | void

export interface CommandContribution {
  id: string
  title: string
  description?: string
  argsSchema?: JsonObject
  defaultArgs?: JsonObject
  dangerLevel?: CommandDangerLevel
  execute(
    args: JsonObject,
    event: CommandContributionExecuteEvent
  ): MaybePromise<CommandContributionExecuteResult>
}

export type CommandRegistration = Disposable

export interface CommandRegistrar {
  register(command: CommandContribution): CommandRegistration
}
