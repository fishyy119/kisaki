import type {
  CommandContributionRegistrationInfo,
  ExtensionRuntimeHandle,
  SerializableRecord,
  SerializableValue
} from '@kisaki3/extension-api'
import type { CommandRegistrationInput, CommandService } from '@main/services/command'
import {
  requireContributionOwner,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions,
  type RuntimeContributionOwner
} from '../types'

export interface ExtensionCommandContributionPointOptions extends ExtensionContributionDomainOptions {
  command?: CommandService
}

interface ExtensionCommandRegistration {
  owner: RuntimeContributionOwner
  commandId: string
  dispose: () => void
}

export class ExtensionCommandContributionPoint {
  private readonly registrations = new Map<
    ExtensionRuntimeHandle,
    Map<string, ExtensionCommandRegistration>
  >()

  constructor(private readonly options: ExtensionCommandContributionPointOptions) {}

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

    const dispose = commandService.registry.register({
      ...toCommandRegistrationInput(command),
      ownerExtensionId: owner.extension.id,
      execute: async (args, context) => {
        const result = await this.options.requestHost('contributions.commands.execute', {
          runtimeHandle,
          commandId: command.id,
          args: toPublicSerializableRecord(args, 'command args'),
          source: context.source
        })
        return result.output
      }
    })

    scopedRegistrations.set(command.id, {
      owner,
      commandId: command.id,
      dispose
    })
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, commandId: string): void {
    const scopedRegistrations = this.registrations.get(runtimeHandle)
    if (!scopedRegistrations) {
      return
    }

    const registration = scopedRegistrations.get(commandId)
    if (!registration) {
      return
    }

    registration.dispose()
    scopedRegistrations.delete(commandId)
    if (scopedRegistrations.size === 0) {
      this.registrations.delete(runtimeHandle)
    }
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    const scopedRegistrations = this.registrations.get(runtimeHandle)
    if (!scopedRegistrations) {
      return
    }

    for (const registration of scopedRegistrations.values()) {
      registration.dispose()
    }
    this.registrations.delete(runtimeHandle)
  }

  releaseAll(): void {
    for (const runtimeHandle of [...this.registrations.keys()]) {
      this.releaseRuntime(runtimeHandle)
    }
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    const diagnostics: ExtensionContributionReleaseDiagnostic[] = []

    for (const scopedRegistrations of this.registrations.values()) {
      for (const registration of scopedRegistrations.values()) {
        if (registration.owner.extension.id === extensionId) {
          diagnostics.push({
            domain: 'commands',
            detail: registration.commandId
          })
        }
      }
    }

    return diagnostics
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
    dangerLevel: command.dangerLevel
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
