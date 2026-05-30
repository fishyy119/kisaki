import type { CommandDescriptor, CommandInvocationContext } from '@shared/command'

export interface CommandRegistrationInput
  extends
    Omit<Partial<CommandDescriptor>, 'id' | 'title'>,
    Pick<CommandDescriptor, 'id' | 'title'> {
  execute(
    args: Record<string, unknown>,
    context: CommandInvocationContext
  ): Promise<unknown> | unknown
}
