import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type TaskRunActiveListQuery as ExtensionTaskRunActiveListQuery,
  type TaskRunCreateInput as ExtensionTaskRunCreateInput,
  type TaskRunFailureErrorPayload as ExtensionTaskRunFailureErrorPayload,
  type TaskRunHistoryListQuery as ExtensionTaskRunHistoryListQuery,
  type TaskRunProgressUpdate as ExtensionTaskRunProgressUpdate,
  type TaskRunResult as ExtensionTaskRunResult,
  type TaskRunSnapshot as ExtensionTaskRunSnapshot
} from '@kisaki3/extension-api'
import type { CommandService } from '@main/services/command'
import { createLogger } from '@main/log'
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

const log = createLogger('Extension')

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
    const normalized = this.normalizeResultOrFinishRun(record, runId, result, (validationError) =>
      record.handle.fail(validationError)
    )
    record.handle.complete(normalized)
    this.trackedRuns.delete(runId)
  }

  fail(
    runtimeHandle: string,
    runId: string,
    error: ExtensionTaskRunFailureErrorPayload,
    result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>
  ): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    const failureError = toFailureError(error)
    const normalized = this.normalizeResultOrFinishRun(record, runId, result, () =>
      record.handle.fail(failureError)
    )
    record.handle.fail(failureError, normalized)
    this.trackedRuns.delete(runId)
  }

  cancel(
    runtimeHandle: string,
    runId: string,
    result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>
  ): void {
    const record = this.requireTrackedRun(runtimeHandle, runId)
    const normalized = this.normalizeResultOrFinishRun(record, runId, result, () =>
      record.handle.cancel()
    )
    record.handle.cancel(normalized)
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

  cancelOwn(runtimeHandle: string, runId: string): boolean {
    const metadata = this.requireRuntime(runtimeHandle)
    const run = this.options.taskRun.runs.get(runId)
    if (!run || !isOwnExtensionTaskRun(run, metadata.id)) {
      return false
    }

    return this.options.taskRun.runs.cancel(runId)
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

  /**
   * Normalizes a completion result. A rejected result must not leave the run
   * active forever (active runs are memory-only and would linger as zombies),
   * so on validation failure the run is finished through `finishWithoutResult`
   * with the caller's intended terminal status and the validation error is
   * rethrown to the extension.
   */
  private normalizeResultOrFinishRun(
    record: TrackedExtensionTaskRun,
    runId: string,
    result: Omit<ExtensionTaskRunResult, 'status' | 'error'> | undefined,
    finishWithoutResult: (validationError: Error) => void
  ): ReturnType<typeof normalizeCompletionResult> {
    try {
      return normalizeCompletionResult(result)
    } catch (error) {
      log.warn('Extension task run result was rejected; finishing the run without it.', {
        runId,
        extensionId: record.extensionId,
        message: error instanceof Error ? error.message : String(error)
      })
      try {
        finishWithoutResult(
          error instanceof Error ? error : new Error('Task run result was rejected.')
        )
      } finally {
        this.trackedRuns.delete(runId)
      }
      throw error
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
