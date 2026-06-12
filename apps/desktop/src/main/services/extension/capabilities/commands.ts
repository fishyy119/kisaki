import {
  createUnavailableError,
  type CommandDescriptor,
  type CommandInvocationRequest,
  type CommandInvocationResult,
  type CommandListItem,
  type ExtensionRuntimeMetadata,
  type JsonObject,
  type JsonValue
} from '@kisaki3/extension-api'
import type { CommandService } from '@main/services/command'
import type {
  CommandDescriptor as AppCommandDescriptor,
  CommandInvocationResult as AppCommandInvocationResult,
  CommandListItem as AppCommandListItem
} from '@shared/command'

export interface ExtensionCommandsCapabilityProviderOptions {
  command: CommandService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionCommandsCapabilityProvider {
  constructor(private readonly options: ExtensionCommandsCapabilityProviderOptions) {}

  list(runtimeHandle: string): CommandListItem[] {
    this.requireRuntime(runtimeHandle)
    return this.options.command.registry.list().map((command) => toPublicCommandListItem(command))
  }

  get(runtimeHandle: string, commandId: string): CommandDescriptor | null {
    this.requireRuntime(runtimeHandle)
    const command = this.options.command.registry.get(commandId)
    return command ? toPublicCommandDescriptor(command) : null
  }

  async invoke(
    runtimeHandle: string,
    request: CommandInvocationRequest
  ): Promise<CommandInvocationResult> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.assertCommandCallable(metadata, request.commandId)
    return toPublicCommandInvocationResult(
      await this.options.command.invoke({
        commandId: request.commandId,
        args: request.args,
        source: {
          type: 'extension',
          extension: {
            id: metadata.id,
            nameSnapshot: metadata.name
          }
        }
      })
    )
  }

  releaseRuntime(_runtimeHandle: string): void {}

  releaseAll(): void {}

  private assertCommandCallable(metadata: ExtensionRuntimeMetadata, commandId: string): void {
    const command = this.options.command.registry.get(commandId)
    if (!command) {
      throw new Error(`Command "${commandId}" is not registered.`)
    }

    if (command.ownerExtensionId && command.ownerExtensionId !== metadata.id) {
      throw new Error(`Extension "${metadata.id}" cannot execute command "${commandId}".`)
    }
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function toPublicCommandListItem(command: AppCommandListItem): CommandListItem {
  return toPublicCommandDescriptor(command)
}

function toPublicCommandDescriptor(command: AppCommandDescriptor): CommandDescriptor {
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    argsSchema: toOptionalPublicJsonObject(command.argsSchema),
    defaultArgs: toOptionalPublicJsonObject(command.defaultArgs),
    dangerLevel: command.dangerLevel,
    ownerExtensionId: command.ownerExtensionId
  }
}

// The RPC channel normalizes responses into the JSON model, so the public
// mappers only narrow types instead of copying values.

function toPublicCommandInvocationResult(
  result: AppCommandInvocationResult
): CommandInvocationResult {
  return {
    commandId: result.commandId,
    output: result.output as JsonValue | undefined
  }
}

function toOptionalPublicJsonObject(
  value: Record<string, unknown> | undefined
): JsonObject | undefined {
  return value as JsonObject | undefined
}
