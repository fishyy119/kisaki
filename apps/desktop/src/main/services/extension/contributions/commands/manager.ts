import type {
  CommandContributionRegistrationInfo,
  ExtensionRuntimeHandle,
  SerializableRecord,
  SerializableValue
} from '@kisaki/extension-api'
import type { CommandRegistrationInput, CommandService } from '@main/services/command'
import { requireContributionOwner, type ExtensionContributionHostOptions } from '../types'

export interface ExtensionCommandContributionHostOptions extends ExtensionContributionHostOptions {
  command?: CommandService
}

export class ExtensionCommandContributionHost {
  private readonly registrations = new Map<string, Map<string, () => void>>()

  constructor(private readonly options: ExtensionCommandContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    command: CommandContributionRegistrationInfo
  ): void {
    const commandService = this.requireCommandService()
    const owner = requireContributionOwner(this.options, runtimeHandle)
    let scopedRegistrations = this.registrations.get(runtimeHandle)
    if (!scopedRegistrations) {
      scopedRegistrations = new Map()
      this.registrations.set(runtimeHandle, scopedRegistrations)
    }

    if (scopedRegistrations.has(command.id)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered command contribution "${command.id}".`
      )
    }

    const dispose = commandService.register({
      ...toCommandRegistrationInput(command),
      ownerExtensionId: owner.extension.id,
      execute: async (args, context) => {
        const result = await this.options.requestHost(
          'contributions.commands.execute',
          {
            runtimeHandle,
            commandId: command.id,
            executionId: context.executionId,
            args: toPublicSerializableRecord(args, 'command args'),
            source: {
              kind: context.source.kind,
              extensionId: context.source.extensionId,
              commandId: context.source.commandId,
              taskId: context.source.taskId
            }
          },
          { signal: context.signal }
        )
        return result.output
      }
    })

    scopedRegistrations.set(command.id, dispose)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, commandId: string): void {
    const scopedRegistrations = this.registrations.get(runtimeHandle)
    const dispose = scopedRegistrations?.get(commandId)
    if (!dispose) {
      return
    }

    dispose()
    scopedRegistrations!.delete(commandId)
    if (scopedRegistrations!.size === 0) {
      this.registrations.delete(runtimeHandle)
    }
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    const scopedRegistrations = this.registrations.get(runtimeHandle)
    if (!scopedRegistrations) {
      return
    }

    for (const dispose of scopedRegistrations.values()) {
      dispose()
    }
    this.registrations.delete(runtimeHandle)
  }

  releaseAll(): void {
    for (const runtimeHandle of [...this.registrations.keys()]) {
      this.releaseRuntime(runtimeHandle)
    }
  }

  private requireCommandService(): CommandService {
    if (!this.options.command) {
      throw new Error('Command service is not available for extension command contributions.')
    }
    return this.options.command
  }
}

function toCommandRegistrationInput(
  command: CommandContributionRegistrationInfo
): Omit<CommandRegistrationInput, 'execute'> {
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    argsSchema: command.argsSchema,
    defaultArgs: command.defaultArgs,
    dangerLevel: command.dangerLevel,
    cancelable: command.cancelable
  }
}

function toPublicSerializableRecord(value: unknown, label: string): SerializableRecord {
  const normalized = toPublicSerializableValue(value, label)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error(`${label} must be a serializable object.`)
  }
  return normalized as SerializableRecord
}

function toPublicSerializableValue(value: unknown, label: string): SerializableValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} number values must be finite.`)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toPublicSerializableValue(entry, label))
  }

  if (value && typeof value === 'object') {
    const record: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      record[key] = toPublicSerializableValue(entry, label)
    }
    return record
  }

  throw new Error(`${label} must be JSON serializable.`)
}
