import type { CommandDescriptor, CommandExecutionSource } from '@shared/command'

export interface CommandExecutionContext {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  signal: AbortSignal
}

export interface CommandRegistrationInput
  extends
    Omit<Partial<CommandDescriptor>, 'id' | 'title'>,
    Pick<CommandDescriptor, 'id' | 'title'> {
  execute(
    args: Record<string, unknown>,
    context: CommandExecutionContext
  ): Promise<unknown> | unknown
}
