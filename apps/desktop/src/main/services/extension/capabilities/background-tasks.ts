import {
  createUnavailableError,
  type BackgroundTask,
  type BackgroundTaskCreateInput,
  type BackgroundTaskRunRecord,
  type BackgroundTaskUpdateInput,
  type ExtensionRuntimeMetadata,
  type SerializableRecord,
  type SerializableValue
} from '@kisaki3/extension-api'
import type { BackgroundTaskService } from '@main/services/background-task'
import type { CommandService } from '@main/services/command'
import type {
  BackgroundTask as AppBackgroundTask,
  BackgroundTaskRunRecord as AppBackgroundTaskRunRecord
} from '@shared/background-task'

export interface ExtensionBackgroundTasksCapabilityProviderOptions {
  backgroundTask: BackgroundTaskService
  command: CommandService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionBackgroundTasksCapabilityProvider {
  constructor(private readonly options: ExtensionBackgroundTasksCapabilityProviderOptions) {}

  list(runtimeHandle: string): BackgroundTask[] {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.backgroundTask.store
      .list()
      .filter((task) => task.ownerExtensionId === metadata.id)
      .map((task) => toPublicBackgroundTask(task))
  }

  get(runtimeHandle: string, taskId: string): BackgroundTask | null {
    const metadata = this.requireRuntime(runtimeHandle)
    const task = this.options.backgroundTask.store.get(taskId)
    if (!task || task.ownerExtensionId !== metadata.id) {
      return null
    }
    return toPublicBackgroundTask(task)
  }

  async create(runtimeHandle: string, input: BackgroundTaskCreateInput): Promise<BackgroundTask> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.assertCommandOwnedByExtension(metadata, input.commandId)
    const task = await this.options.backgroundTask.store.create({
      name: input.name,
      ownerExtensionId: metadata.id,
      createdBy: 'extension',
      commandId: input.commandId,
      args: input.args,
      enabled: input.enabled,
      triggers: input.triggers,
      failurePolicy: input.failurePolicy
    })
    return toPublicBackgroundTask(task)
  }

  async update(
    runtimeHandle: string,
    taskId: string,
    patch: BackgroundTaskUpdateInput
  ): Promise<BackgroundTask> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedTask(metadata, taskId)
    if (patch.commandId) {
      this.assertCommandOwnedByExtension(metadata, patch.commandId)
    }

    const task = await this.options.backgroundTask.store.update(taskId, patch)
    return toPublicBackgroundTask(task)
  }

  async setEnabled(
    runtimeHandle: string,
    taskId: string,
    enabled: boolean
  ): Promise<BackgroundTask> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedTask(metadata, taskId)
    return toPublicBackgroundTask(
      await this.options.backgroundTask.store.setEnabled(taskId, enabled)
    )
  }

  async delete(runtimeHandle: string, taskId: string): Promise<void> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedTask(metadata, taskId)
    await this.options.backgroundTask.store.delete(taskId)
  }

  async run(runtimeHandle: string, taskId: string): Promise<BackgroundTaskRunRecord> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedTask(metadata, taskId)
    return toPublicBackgroundTaskRunRecord(await this.options.backgroundTask.runner.runNow(taskId))
  }

  cancel(runtimeHandle: string, taskId: string): boolean {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedTask(metadata, taskId)
    return this.options.backgroundTask.runner.cancel(taskId)
  }

  private assertCommandOwnedByExtension(
    metadata: ExtensionRuntimeMetadata,
    commandId: string
  ): void {
    const command = this.options.command.registry.get(commandId)
    if (!command) {
      throw new Error(`Command "${commandId}" is not registered.`)
    }

    if (command.ownerExtensionId !== metadata.id) {
      throw new Error(`Extension "${metadata.id}" cannot create tasks for command "${commandId}".`)
    }
  }

  private requireOwnedTask(metadata: ExtensionRuntimeMetadata, taskId: string): AppBackgroundTask {
    const task = this.options.backgroundTask.store.get(taskId)
    if (!task || task.ownerExtensionId !== metadata.id) {
      throw new Error(`Background task "${taskId}" is not owned by "${metadata.id}".`)
    }
    return task
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function toPublicBackgroundTask(task: AppBackgroundTask): BackgroundTask {
  return {
    id: task.id,
    name: task.name,
    ownerExtensionId: task.ownerExtensionId,
    createdBy: task.createdBy,
    commandId: task.commandId,
    args: toPublicSerializableRecord(task.args, 'background task args'),
    enabled: task.enabled,
    triggers: task.triggers,
    failurePolicy: task.failurePolicy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastRunAt: task.lastRunAt,
    nextRunAt: task.nextRunAt,
    history: task.history.map((record) => toPublicBackgroundTaskRunRecord(record))
  }
}

function toPublicBackgroundTaskRunRecord(
  record: AppBackgroundTaskRunRecord
): BackgroundTaskRunRecord {
  return {
    id: record.id,
    taskId: record.taskId,
    commandId: record.commandId,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    status: record.status,
    attempt: record.attempt,
    trigger: record.trigger,
    output:
      record.output === undefined
        ? undefined
        : toPublicSerializableValue(record.output, 'background task output'),
    error: record.error
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
