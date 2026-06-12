import {
  isExtensionTaskRunCancellation,
  type ExtensionLogger,
  type ExtensionTaskRunProgressUpdate,
  type ExtensionTaskRunProgressWork,
  type ExtensionTaskRunResult
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import type { AccountService } from '../auth/account'
import type { TokenService } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import type { MediaRegistry } from '../media/registry'
import type { SyncEngine } from '../sync/engine'
import type { SyncQueueStore } from '../sync/queue'
import type { SyncSuppressor } from '../sync/suppressor'
import type { BangumiJobPreviewGroup } from '../../shared/settings'
import {
  createBangumiJobSummary,
  createJobError,
  isCancellationError,
  type BangumiJobError,
  type BangumiJobSummary
} from './summary'
import { BangumiExtensionError } from '../utils/errors'

type JobProgressWorkInput = Partial<
  Pick<ExtensionTaskRunProgressWork, 'current' | 'total' | 'ratePeriod' | 'indeterminate'>
>

export interface JobRunnerDependencies {
  settingsStore: SettingsStore
  client: BangumiClient
  tokenService: TokenService
  accountService: AccountService
  syncEngine: SyncEngine
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
  report(update: ExtensionTaskRunProgressUpdate): Promise<void>
  checkpoint(): Promise<void>
  complete(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  fail(error: unknown, result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  cancel(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
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

  report(phase: string, label: string, progress: JobProgressWorkInput = {}): void {
    const update: ExtensionTaskRunProgressUpdate = {
      phase: {
        key: phase,
        label
      },
      counters: this.state.counters
    }
    const work = createProgressWork(progress)
    if (work) {
      update.work = work
    }
    void this.run.report(update).catch(() => undefined)
  }
}

function createProgressWork(
  progress: JobProgressWorkInput
): ExtensionTaskRunProgressWork | undefined {
  const work: ExtensionTaskRunProgressWork = {}
  if (progress.current !== undefined) {
    work.current = progress.current
  }
  if (progress.total !== undefined) {
    work.total = progress.total
  }
  if (progress.current !== undefined || progress.total !== undefined) {
    work.unit = 'item'
  }
  if (progress.ratePeriod !== undefined) {
    work.ratePeriod = progress.ratePeriod
  }
  if (progress.indeterminate !== undefined) {
    work.indeterminate = progress.indeterminate
  }

  return Object.keys(work).length > 0 ? work : undefined
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
    const summary = createBangumiJobSummary({
      commandId: state.commandId,
      startedAt: state.startedAt,
      counters: state.counters,
      previewGroups: state.previewGroups,
      errors: state.errors
    })
    await context.run.complete({
      summary: 'Bangumi job 已完成。',
      output: summary,
      counters: state.counters
    })
    return summary
  } catch (error) {
    if (
      isExtensionTaskRunCancellation(error) ||
      isCancellationError(error) ||
      context.run.signal.aborted
    ) {
      job.report('cancelled', 'Bangumi job 已取消。', { indeterminate: true })
      const summary = createBangumiJobSummary({
        commandId: state.commandId,
        startedAt: state.startedAt,
        counters: state.counters,
        previewGroups: state.previewGroups,
        errors: state.errors
      })
      await context.run.cancel({
        summary: 'Bangumi job 已取消。',
        output: summary,
        counters: state.counters
      })
      return summary
    }

    state.errors.push(createJobError(error))
    const message = toUserErrorMessage(error)
    job.report('failed', message, { indeterminate: true })
    const summary = createBangumiJobSummary({
      commandId: state.commandId,
      startedAt: state.startedAt,
      counters: state.counters,
      previewGroups: state.previewGroups,
      errors: state.errors
    })
    await context.run.fail(error, {
      summary: message,
      output: summary,
      counters: state.counters
    })
    logger?.warn('Bangumi job failed.', toSafeErrorLog(error))
    return summary
  }
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Bangumi job 执行失败。'
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
