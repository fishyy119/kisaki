import type { CommandDescriptor, CommandListItem } from '@shared/command'
import type { CommandRegistrationInput } from './types'

export interface RegisteredCommand {
  descriptor: CommandDescriptor
  execute: CommandRegistrationInput['execute']
}

export interface CommandRegistryOptions {
  isRunning(commandId: string): boolean
}

export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>()

  constructor(private readonly options: CommandRegistryOptions) {}

  register(command: CommandRegistrationInput): () => void {
    const descriptor = normalizeCommandDescriptor(command)
    if (this.commands.has(descriptor.id)) {
      throw new Error(`Command "${descriptor.id}" is already registered.`)
    }

    this.commands.set(descriptor.id, {
      descriptor,
      execute: command.execute
    })

    return () => {
      const current = this.commands.get(descriptor.id)
      if (current?.execute === command.execute) {
        this.commands.delete(descriptor.id)
      }
    }
  }

  list(): CommandListItem[] {
    return [...this.commands.values()]
      .map(({ descriptor }) => ({
        ...descriptor,
        running: this.options.isRunning(descriptor.id)
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  get(commandId: string): CommandDescriptor | null {
    return this.commands.get(commandId)?.descriptor ?? null
  }

  getRegisteredCommand(commandId: string): RegisteredCommand | null {
    return this.commands.get(commandId) ?? null
  }

  clear(): void {
    this.commands.clear()
  }
}

function normalizeCommandDescriptor(command: CommandRegistrationInput): CommandDescriptor {
  const id = command.id.trim()
  if (!id) {
    throw new Error('Command id is required.')
  }

  const title = command.title.trim()
  if (!title) {
    throw new Error(`Command "${id}" title is required.`)
  }

  return {
    id,
    title,
    description: command.description,
    argsSchema: command.argsSchema,
    defaultArgs: command.defaultArgs,
    dangerLevel: command.dangerLevel ?? 'none',
    cancelable: command.cancelable ?? false,
    ownerExtensionId: command.ownerExtensionId
  }
}
