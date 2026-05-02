import type { CommandDangerLevel, CommandExecutionContext } from '../../capabilities/commands'
import type { Disposable, MaybePromise, SerializableRecord, SerializableValue } from '../../shared'

export interface CommandContribution {
  id: string
  title: string
  description?: string
  argsSchema?: SerializableRecord
  defaultArgs?: SerializableRecord
  dangerLevel?: CommandDangerLevel
  cancelable?: boolean
  execute(
    args: SerializableRecord,
    context: CommandExecutionContext
  ): MaybePromise<SerializableValue | void>
}

export interface CommandRegistrar {
  register(command: CommandContribution): Promise<Disposable>
}
