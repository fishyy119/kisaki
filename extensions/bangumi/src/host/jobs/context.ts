import {
  createTaskRunProgressWork,
  type ExtensionLogger,
  type JsonObject,
  type TaskRunProgressUpdate,
  type TaskRunProgressWorkInput,
  type TaskRunResult,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import type { AccountService } from '../auth/account'
import type { TokenService } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import type { MediaRegistry } from '../media/registry'
import type { SyncEngine } from '../sync/engine'
import type { EpisodeSyncEngine } from '../sync/episodes'
import type { SyncQueueStore } from '../sync/queue'
import type { SyncSuppressor } from '../sync/suppressor'
import type { BangumiJobPreviewGroup } from '../../shared/settings'
import {
  createBangumiJobSummary,
  createJobError,
  type BangumiJobError,
  type BangumiJobSummary
} from './summary'
import { BangumiExtensionError, isCancellationError } from '../utils/errors'
import { m } from '../i18n'

/**
 * Representative failures forwarded to the task run result. The full error
 * list stays on the in-process summary; task-run results are bounded
 * summaries by contract.
 */
const RESULT_WARNING_LIMIT = 10

export interface JobRunnerDependencies {
  settingsStore: SettingsStore
  client: BangumiClient
  tokenService: TokenService
  accountService: AccountService
  syncEngine: SyncEngine
  episodeSyncEngine: EpisodeSyncEngine
  mediaRegistry: MediaRegistry
  syncQueueStore: SyncQueueStore
  syncSuppressor: SyncSuppressor
  logger?: ExtensionLogger
}

export interface BangumiJobRun {
  commandId: string
  run: BangumiJobHandle
}

export interface BangumiJobHandle {
  readonly signal: AbortSignal
  report(update: TaskRunProgressUpdate): Promise<void>
  checkpoint(): Promise<void>
  complete(result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
  fail(error: unknown, result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
  cancel(result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
}

export interface JobCounters {
  [key: string]: number
}

interface JobState {
  commandId: string
  startedAt: number
  counters: JobCounters
  previewGroups: BangumiJobPreviewGroup[]
  errors: BangumiJobError[]
}

export class JobStateController {
  constructor(
    private readonly state: JobState,
    private readonly run: BangumiJobHandle
  ) {}

  get counters(): JobCounters {
    return this.state.counters
  }

  get signal(): AbortSignal {
    return this.run.signal
  }

  checkpoint(): Promise<void> {
    return this.run.checkpoint()
  }

  increment(key: string, amount = 1): void {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + amount
  }

  addPreviewGroup(group: BangumiJobPreviewGroup): void {
    this.state.previewGroups.push(group)
  }

  addError(error: unknown, context: Partial<BangumiJobError> = {}): void {
    this.state.errors.push(createJobError(error, context))
  }

  report(phase: string, label: string, progress: TaskRunProgressWorkInput = {}): void {
    const update: TaskRunProgressUpdate = {
      phase: {
        key: phase,
        label
      },
      counters: this.state.counters
    }
    const work = createTaskRunProgressWork(progress)
    if (work) {
      update.work = work
    }
    void this.run.report(update).catch(() => undefined)
  }
}

export async function runBangumiJob(
  context: BangumiJobRun,
  logger: ExtensionLogger | undefined,
  execute: (job: JobStateController) => Promise<void>
): Promise<BangumiJobSummary> {
  const state: JobState = {
    commandId: context.commandId,
    startedAt: Date.now(),
    counters: {},
    previewGroups: [],
    errors: []
  }
  const job = new JobStateController(state, context.run)

  try {
    await job.checkpoint()
    await execute(job)
    await job.checkpoint()
    const summary = createSummary(state)
    await finishRun(logger, () =>
      context.run.complete({
        summary: m().jobs.completed,
        output: toTaskRunOutput(summary),
        counters: state.counters,
        warnings: toTaskRunWarnings(summary)
      })
    )
    return summary
  } catch (error) {
    if (isCancellationError(error) || context.run.signal.aborted) {
      job.report('cancelled', m().jobs.cancelled, { indeterminate: true })
      const summary = createSummary(state)
      await finishRun(logger, () =>
        context.run.cancel({
          summary: m().jobs.cancelled,
          output: toTaskRunOutput(summary),
          counters: state.counters,
          warnings: toTaskRunWarnings(summary)
        })
      )
      return summary
    }

    state.errors.push(createJobError(error))
    const message = toUserErrorMessage(error)
    job.report('failed', message, { indeterminate: true })
    const summary = createSummary(state)
    await finishRun(logger, () =>
      context.run.fail(error, {
        summary: message,
        output: toTaskRunOutput(summary),
        counters: state.counters,
        warnings: toTaskRunWarnings(summary)
      })
    )
    logger?.warn('Bangumi job failed.', toSafeErrorLog(error))
    return summary
  }
}

function createSummary(state: JobState): BangumiJobSummary {
  return createBangumiJobSummary({
    commandId: state.commandId,
    startedAt: state.startedAt,
    counters: state.counters,
    previewGroups: state.previewGroups,
    errors: state.errors
  })
}

/**
 * Finishing the run must never break the in-process summary flow: if the host
 * rejects the result payload it also terminates the run with a minimal
 * terminal state, so the rejection is only logged here.
 */
async function finishRun(
  logger: ExtensionLogger | undefined,
  finish: () => Promise<void>
): Promise<void> {
  try {
    await finish()
  } catch (error) {
    logger?.warn('Bangumi task run result was rejected.', toSafeErrorLog(error))
  }
}

/**
 * Bounded task-run output: totals only. The full preview groups and error
 * list stay on the in-process summary consumed by the settings webview.
 */
function toTaskRunOutput(summary: BangumiJobSummary): JsonObject {
  return {
    version: summary.version,
    commandId: summary.commandId,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    counters: summary.counters,
    previewGroupsTotal: summary.previewGroups.length,
    errorsTotal: summary.errors.length
  }
}

function toTaskRunWarnings(summary: BangumiJobSummary): readonly TaskRunWarning[] {
  return summary.errors.slice(0, RESULT_WARNING_LIMIT).map((error) => ({
    code: error.code,
    message: error.message
  }))
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return m().errors.jobFailed
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
