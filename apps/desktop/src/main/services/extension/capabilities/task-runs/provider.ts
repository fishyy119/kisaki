import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type ExtensionTaskRunActiveListQuery,
  type ExtensionTaskRunCreateInput,
  type ExtensionTaskRunFailureErrorPayload,
  type ExtensionTaskRunHistoryListQuery,
  type ExtensionTaskRunProgressUpdate,
  type ExtensionTaskRunResult,
  type ExtensionTaskRunSnapshot
} from '@kisaki3/extension-api'
import type { CommandService } from '@main/services/command'
import type { TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation, type TaskRunHandle } from '@main/services/task-run'
import type { ExtensionHostRpcClient } from '../../runtime'
import { createTaskRunCancelledError, toFailureError } from './errors'
import {
  isOwnExtensionTaskRun,
  toInternalExtensionTaskRunOperation,
  toPublicExtensionTaskRunSnapshot
} from './mappers'
import {
  normalizeCompletionResult,
  normalizeCreateInput,
  normalizeProgressUpdate,
  toActiveQuery,
  toHistoryQuery
} from './validation'

export interface ExtensionTaskRunsCapabilityProviderOptions {
  taskRun: TaskRunService
  command: CommandService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

interface TrackedExtensionTaskRun {
  runtimeHandle: string
  extensionId: string
  handle: TaskRunHandle
}

export class ExtensionTaskRunsCapabilityProvider {
  private readonly trackedRuns = new Map<string, TrackedExtensionTaskRun>()
  private rpc: ExtensionHostRpcClient | null = null

  constructor(private readonly options: ExtensionTaskRunsCapabilityProviderOptions) {
    this.options.taskRun.runs.onCancelRequested((request) => {
      this.handleCancelRequested(request.run.id)
    })
  }

  attachRpc(rpc: ExtensionHostRpcClient): void {
    this.rpc = rpc
  }

  detachRpc(): void {
    this.rpc = null
  }

  create(runtimeHandle: string, input: ExtensionTaskRunCreateInput): ExtensionTaskRunSnapshot {
    const metadata = this.requireRuntime(runtimeHandle)
    const normalized = normalizeCreateInput(input, metadata, this.options.command)
    const handle = this.options.taskRun.runs.create({
      category: 'extension',
      operation: toInternalExtensionTaskRunOperation(metadata.id, normalized.operation),
      title: normalized.title,
      description: normalized.description,
      owner: {
        type: 'extension',
        extension: {
          id: metadata.id,
          nameSnapshot: metadata.name
        }
      },
      initiator: normalized.initiator,
      subject: normalized.subject,
      controls: normalized.controls,
      presentation: normalized.presentation
    })

    this.trackedRuns.set(handle.id, {
      runtimeHandle,
      extensionId: metadata.id,
      handle
    })
    handle.start()

    const run = this.options.taskRun.runs.get(handle.id)
    if (!run) {
      throw new Error(`Task run "${handle.id}" was not created.`)
    }

    return toPublicExtensionTaskRunSnapshot(metadata.id, run)
  }

  report(runtimeHandle: string, runId: string, update: ExtensionTaskRunProgressUpdate): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    record.handle.context.report(normalizeProgressUpdate(update))
  }

  async checkpoint(runtimeHandle: string, runId: string): Promise<void> {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    try {
      await record.handle.context.checkpoint()
    } catch (error) {
      if (isTaskRunCancellation(error)) {
        throw createTaskRunCancelledError()
      }

      throw error
    }
  }

  complete(
    runtimeHandle: string,
    runId: string,
    result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>
  ): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    record.handle.complete(normalizeCompletionResult(result))
    this.trackedRuns.delete(runId)
  }

  fail(
    runtimeHandle: string,
    runId: string,
    error: ExtensionTaskRunFailureErrorPayload,
    result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>
  ): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    record.handle.fail(toFailureError(error), normalizeCompletionResult(result))
    this.trackedRuns.delete(runId)
  }

  cancel(
    runtimeHandle: string,
    runId: string,
    result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>
  ): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    record.handle.cancel(normalizeCompletionResult(result))
    this.trackedRuns.delete(runId)
  }

  listActiveOwn(
    runtimeHandle: string,
    query?: ExtensionTaskRunActiveListQuery
  ): readonly ExtensionTaskRunSnapshot[] {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.taskRun.runs
      .list(toActiveQuery(metadata.id, query))
      .filter((run) => isOwnExtensionTaskRun(run, metadata.id))
      .map((run) => toPublicExtensionTaskRunSnapshot(metadata.id, run))
  }

  listHistoryOwn(
    runtimeHandle: string,
    query?: ExtensionTaskRunHistoryListQuery
  ): readonly ExtensionTaskRunSnapshot[] {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.taskRun.history
      .list(toHistoryQuery(metadata.id, query))
      .filter((run) => isOwnExtensionTaskRun(run, metadata.id))
      .map((run) => toPublicExtensionTaskRunSnapshot(metadata.id, run))
  }

  getActiveOwn(runtimeHandle: string, runId: string): ExtensionTaskRunSnapshot | null {
    const metadata = this.requireRuntime(runtimeHandle)
    const run = this.options.taskRun.runs.get(runId)
    return run && isOwnExtensionTaskRun(run, metadata.id)
      ? toPublicExtensionTaskRunSnapshot(metadata.id, run)
      : null
  }

  getHistoryOwn(runtimeHandle: string, runId: string): ExtensionTaskRunSnapshot | null {
    const metadata = this.requireRuntime(runtimeHandle)
    const run = this.options.taskRun.history.get(runId)
    return run && isOwnExtensionTaskRun(run, metadata.id)
      ? toPublicExtensionTaskRunSnapshot(metadata.id, run)
      : null
  }

  async waitOwn(runtimeHandle: string, runId: string): Promise<ExtensionTaskRunSnapshot> {
    const metadata = this.requireRuntime(runtimeHandle)
    const active = this.options.taskRun.runs.get(runId)
    if (!active || !isOwnExtensionTaskRun(active, metadata.id)) {
      throw new Error(`Task run "${runId}" is not active for this extension.`)
    }

    return toPublicExtensionTaskRunSnapshot(
      metadata.id,
      await this.options.taskRun.runs.wait(runId)
    )
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [runId, record] of [...this.trackedRuns]) {
      if (record.runtimeHandle !== runtimeHandle) {
        continue
      }

      try {
        record.handle.cancel({ summary: 'Extension runtime stopped.' })
      } finally {
        this.trackedRuns.delete(runId)
      }
    }
  }

  releaseAll(): void {
    for (const runtimeHandle of new Set(
      [...this.trackedRuns.values()].map((run) => run.runtimeHandle)
    )) {
      this.releaseRuntime(runtimeHandle)
    }
  }

  private requireTrackedRun(runtimeHandle: string, runId: string): TrackedExtensionTaskRun {
    const metadata = this.requireRuntime(runtimeHandle)
    const record = this.trackedRuns.get(runId)
    if (!record || record.runtimeHandle !== runtimeHandle || record.extensionId !== metadata.id) {
      throw new Error(`Task run "${runId}" is not owned by this extension runtime.`)
    }

    return record
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }

  private handleCancelRequested(runId: string): void {
    const record = this.trackedRuns.get(runId)
    if (!record || !this.rpc) {
      return
    }

    this.rpc.sendEventToHost('capabilities.taskRuns.cancelRequested', {
      runtimeHandle: record.runtimeHandle,
      runId
    })
  }
}
