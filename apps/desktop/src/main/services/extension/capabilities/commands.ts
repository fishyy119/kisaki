import {
  createUnavailableError,
  type CommandDescriptor,
  type CommandExecutionProgress,
  type CommandExecutionPresentation,
  type CommandExecutionRequest,
  type CommandExecutionResult,
  type CommandExecutionSource,
  type CommandExecutionStartResult,
  type CommandListItem,
  type ExtensionRuntimeMetadata,
  type SerializableRecord,
  type SerializableValue
} from '@kisaki/extension-api'
import type { CommandService } from '@main/services/command'
import type {
  CommandDescriptor as AppCommandDescriptor,
  CommandExecutionProgress as AppCommandExecutionProgress,
  CommandExecutionPresentation as AppCommandExecutionPresentation,
  CommandExecutionResult as AppCommandExecutionResult,
  CommandExecutionSource as AppCommandExecutionSource,
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

  start(runtimeHandle: string, request: CommandExecutionRequest): CommandExecutionStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    this.assertCommandCallable(metadata, request.commandId)
    return this.options.command.executions.start({
      commandId: request.commandId,
      args: request.args,
      source: { kind: 'extension', extensionId: metadata.id, commandId: request.commandId },
      presentation: toAppCommandExecutionPresentation(request.presentation)
    })
  }

  async wait(runtimeHandle: string, executionId: string): Promise<CommandExecutionResult> {
    this.requireRuntime(runtimeHandle)
    return toPublicCommandExecutionResult(await this.options.command.executions.wait(executionId))
  }

  getProgress(runtimeHandle: string, executionId: string): CommandExecutionProgress | null {
    this.requireRuntime(runtimeHandle)
    const progress = this.options.command.executions.getProgress(executionId)
    return progress ? toPublicCommandExecutionProgress(progress) : null
  }

  async execute(
    runtimeHandle: string,
    request: CommandExecutionRequest
  ): Promise<CommandExecutionResult> {
    const started = this.start(runtimeHandle, request)
    return this.wait(runtimeHandle, started.executionId)
  }

  cancel(runtimeHandle: string, executionId: string): boolean {
    this.requireRuntime(runtimeHandle)
    return this.options.command.executions.cancel(executionId)
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
  return {
    ...toPublicCommandDescriptor(command),
    running: command.running
  }
}

function toPublicCommandDescriptor(command: AppCommandDescriptor): CommandDescriptor {
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    argsSchema: toOptionalPublicSerializableRecord(command.argsSchema),
    defaultArgs: toOptionalPublicSerializableRecord(command.defaultArgs),
    dangerLevel: command.dangerLevel,
    cancelable: command.cancelable,
    ownerExtensionId: command.ownerExtensionId,
    notification: command.notification
  }
}

function toAppCommandExecutionPresentation(
  presentation: CommandExecutionPresentation | undefined
): AppCommandExecutionPresentation | undefined {
  if (!presentation) {
    return undefined
  }

  return {
    notify: presentation.notify
      ? {
          enabled: presentation.notify.enabled,
          title: presentation.notify.title,
          message: presentation.notify.message,
          cancelable: presentation.notify.cancelable
        }
      : undefined
  }
}

function toPublicCommandExecutionResult(result: AppCommandExecutionResult): CommandExecutionResult {
  return {
    commandId: result.commandId,
    executionId: result.executionId,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    status: result.status,
    output:
      result.output === undefined
        ? undefined
        : toPublicSerializableValue(result.output, 'command output'),
    error: result.error
  }
}

function toPublicCommandExecutionProgress(
  progress: AppCommandExecutionProgress
): CommandExecutionProgress {
  return {
    commandId: progress.commandId,
    executionId: progress.executionId,
    source: toPublicCommandExecutionSource(progress.source),
    updatedAt: progress.updatedAt,
    phase: progress.phase,
    message: progress.message,
    current: progress.current,
    total: progress.total,
    indeterminate: progress.indeterminate
  }
}

function toPublicCommandExecutionSource(source: AppCommandExecutionSource): CommandExecutionSource {
  return {
    kind: source.kind,
    extensionId: source.extensionId,
    commandId: source.commandId,
    taskId: source.taskId
  }
}

function toOptionalPublicSerializableRecord(
  value: Record<string, unknown> | undefined
): SerializableRecord | undefined {
  return value === undefined ? undefined : toPublicSerializableRecord(value, 'command record')
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
