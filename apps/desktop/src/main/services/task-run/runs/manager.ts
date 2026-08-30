import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createLogger } from '@main/log'
import type { IpcService } from '@main/services/ipc'
import type {
  TaskRun,
  TaskRunActiveListQuery,
  TaskRunControls,
  TaskRunFinalStatus,
  TaskRunProgress,
  TaskRunProgressUpdate,
  TaskRunResult,
  TaskRunStatus
} from '@shared/task-run'
import type { TaskRunHistoryStore } from '../history/store'
import type { TaskRunNotificationCoordinator } from '../notifications'
import { TaskRunRateCalculator } from '../rate'
import { createTaskPauseController, type TaskRunCancelRequestListener } from './controls'
import { TaskRunCancellation } from './cancellation'
import { DefaultTaskRunContext, type TaskRunContext } from './context'
import { sanitizeProgressUpdate, mergeWorkMetrics } from './progress'
import { applyListLimit, cloneTaskRun, compareActiveTaskRuns, matchesTaskRunQuery } from './query'
import { createFinalResult, sanitizeCompletionResult, toSafeErrorMessage } from './result'
import { assertTaskRunActiveStatus, assertTaskRunTransition } from './transitions'
import type {
  ActiveTaskRunRecord,
  TaskRunCancellationResult,
  TaskRunCompletionResult,
  TaskRunCreateInput,
  TaskRunFailureResult,
  TaskRunHandle
} from './types'

const log = createLogger('TaskRun')

const PROGRESS_FLUSH_INTERVAL_MS = 100
const PROGRESS_FLUSH_MAX_DELAY_MS = 250
const DISPOSE_SETTLE_TIMEOUT_MS = 500

export interface TaskRunManagerOptions {
  ipc: IpcService
  history: TaskRunHistoryStore
  notifications: TaskRunNotificationCoordinator
}

export class TaskRunManager {
  private readonly active = new Map<string, ActiveTaskRunRecord>()
  private readonly progressTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly cancelListeners = new Set<TaskRunCancelRequestListener>()
  private disposing = false

  constructor(private readonly options: TaskRunManagerOptions) {}

  create(input: TaskRunCreateInput): TaskRunHandle {
    if (this.disposing) {
      throw new Error('Task run service is disposing.')
    }

    const now = Date.now()
    const id = randomUUID()
    const controller = new AbortController()
    const context = new DefaultTaskRunContext(id, controller.signal, this)
    const run: TaskRun = {
      id,
      category: input.category,
      operation: input.operation,
      title: input.title,
      description: input.description,
      status: 'queued',
      owner: input.owner,
      initiator: input.initiator,
      subject: input.subject,
      controls: { ...input.controls },
      createdAt: now,
      updatedAt: now
    }

    const record: ActiveTaskRunRecord = {
      run,
      presentation: input.presentation,
      controller,
      context,
      waiters: [],
      rate: new TaskRunRateCalculator(),
      lastFlushedAt: 0
    }

    this.active.set(id, record)
    this.flushNow(record)
    log.info('Task run created.', { runId: id, operation: run.operation })

    return this.createHandle(id)
  }

  list(query?: TaskRunActiveListQuery): TaskRun[] {
    return applyListLimit(
      [...this.active.values()]
        .map((record) => cloneTaskRun(record.run))
        .filter((run) => matchesTaskRunQuery(run, query))
        .sort(compareActiveTaskRuns),
      query?.limit
    )
  }

  get(runId: string): TaskRun | null {
    const record = this.active.get(runId)
    return record ? cloneTaskRun(record.run) : null
  }

  wait(runId: string): Promise<TaskRun> {
    const record = this.active.get(runId)
    if (!record) {
      return Promise.reject(new Error(`Task run "${runId}" is not active.`))
    }

    return new Promise<TaskRun>((resolve, reject) => {
      record.waiters.push({ resolve, reject })
    })
  }

  cancel(runId: string): boolean {
    const record = this.active.get(runId)
    if (!record || !record.run.controls.cancelable) {
      return false
    }

    return this.requestCancel(record, { emitRequest: true, force: false })
  }

  pause(runId: string): boolean {
    const record = this.active.get(runId)
    if (!record || !record.run.controls.pausable) {
      return false
    }

    if (record.run.status === 'pausing' || record.run.status === 'paused') {
      return true
    }

    if (record.run.status !== 'running') {
      return false
    }

    this.transition(record, 'pausing')
    this.flushNow(record)
    log.info('Task run pause requested.', { runId })
    return true
  }

  resume(runId: string): boolean {
    const record = this.active.get(runId)
    if (!record || !record.run.controls.pausable) {
      return false
    }

    if (record.run.status === 'pausing' || record.run.status === 'paused') {
      this.transition(record, 'running')
      record.pause?.resolve()
      record.pause = undefined
      this.flushNow(record)
      log.info('Task run resumed.', { runId })
      return true
    }

    return false
  }

  onCancelRequested(listener: TaskRunCancelRequestListener): () => void {
    this.cancelListeners.add(listener)
    return () => {
      this.cancelListeners.delete(listener)
    }
  }

  start(runId: string): void {
    const record = this.requireRecord(runId)
    const now = Date.now()
    assertTaskRunTransition(record.run.status, 'running')
    record.run = {
      ...record.run,
      status: 'running',
      startedAt: record.run.startedAt ?? now,
      updatedAt: now
    }
    this.flushNow(record)
    log.info('Task run started.', { runId })
  }

  updateControls(runId: string, controls: Partial<TaskRunControls>): void {
    const record = this.requireRecord(runId)
    assertTaskRunActiveStatus(record.run.status)

    if (
      controls.pausable === false &&
      (record.run.status === 'pausing' || record.run.status === 'paused')
    ) {
      throw new Error('Cannot disable pausing while task run is paused.')
    }

    const nextControls = { ...record.run.controls, ...controls }
    if (
      nextControls.cancelable === record.run.controls.cancelable &&
      nextControls.pausable === record.run.controls.pausable
    ) {
      return
    }

    record.run = {
      ...record.run,
      controls: nextControls,
      updatedAt: Date.now()
    }
    this.flushNow(record)
  }

  report(runId: string, update: TaskRunProgressUpdate): void {
    const record = this.requireRecord(runId)
    assertTaskRunActiveStatus(record.run.status)

    const now = Date.now()
    const sanitized = sanitizeProgressUpdate(update)
    const rateMetrics = record.rate.apply(sanitized, performance.now())
    const progress: TaskRunProgress = {
      ...sanitized,
      updatedAt: now
    }
    const work = mergeWorkMetrics(sanitized.work, rateMetrics)
    if (work !== undefined) {
      progress.work = work
    }
    record.run = {
      ...record.run,
      progress,
      updatedAt: now
    }
    this.scheduleProgressFlush(record)
  }

  async checkpoint(runId: string): Promise<void> {
    const record = this.requireRecord(runId)

    if (record.controller.signal.aborted || isCancellingStatus(record.run.status)) {
      throw new TaskRunCancellation()
    }

    if (record.run.status === 'pausing') {
      record.pause = createTaskPauseController()
      this.transition(record, 'paused')
      this.flushNow(record)
    }

    if (record.run.status === 'paused' && record.pause) {
      await waitForResumeOrAbort(record.context, record.pause.promise)
    }

    if (record.controller.signal.aborted || record.run.status === 'cancelling') {
      throw new TaskRunCancellation()
    }
  }

  complete(runId: string, result?: TaskRunCompletionResult): void {
    this.finish(runId, 'completed', sanitizeCompletionResult(result))
  }

  fail(runId: string, error: unknown, result?: TaskRunFailureResult): void {
    const record = this.requireRecord(runId)

    // Initiator knowledge adjudicates the terminal status: a failure reported
    // after cancellation was requested is the cancellation surfacing through
    // the work's error path, not a new outcome. Completion stays completion —
    // work past its point of no return finished with a real result.
    if (record.controller.signal.aborted || record.run.status === 'cancelling') {
      log.info('Task run reported failure after cancellation; recording cancelled.', {
        runId,
        error: toSafeErrorMessage(error)
      })
      this.finishRecord(record, 'cancelled', sanitizeCompletionResult(result))
      return
    }

    this.finishRecord(record, 'failed', {
      ...sanitizeCompletionResult(result),
      error: toSafeErrorMessage(error)
    })
  }

  finishCancelled(runId: string, result?: TaskRunCancellationResult): void {
    const record = this.requireRecord(runId)
    if (!record.controller.signal.aborted) {
      record.controller.abort()
    }
    this.finishRecord(record, 'cancelled', sanitizeCompletionResult(result))
  }

  async dispose(): Promise<void> {
    this.disposing = true

    for (const record of this.active.values()) {
      this.requestCancel(record, { emitRequest: false, force: true })
    }

    if (this.active.size > 0) {
      await delay(DISPOSE_SETTLE_TIMEOUT_MS)
    }

    for (const record of [...this.active.values()]) {
      this.finishRecord(record, 'cancelled', {
        summary: 'Application is shutting down.'
      })
    }

    for (const timer of this.progressTimers.values()) {
      clearTimeout(timer)
    }
    this.progressTimers.clear()
    this.cancelListeners.clear()
  }

  private createHandle(runId: string): TaskRunHandle {
    const record = this.requireRecord(runId)
    const createdAt = record.run.createdAt
    const context = record.context

    return {
      get id() {
        return runId
      },
      get createdAt() {
        return createdAt
      },
      get context() {
        return context
      },
      start: () => this.start(runId),
      updateControls: (controls) => this.updateControls(runId, controls),
      complete: (result) => this.complete(runId, result),
      fail: (error, result) => this.fail(runId, error, result),
      cancel: (result) => this.finishCancelled(runId, result)
    }
  }

  private requireRecord(runId: string): ActiveTaskRunRecord {
    const record = this.active.get(runId)
    if (!record) {
      throw new Error(`Task run "${runId}" is not active.`)
    }
    return record
  }

  private requestCancel(
    record: ActiveTaskRunRecord,
    options: { emitRequest: boolean; force: boolean }
  ): boolean {
    if (!options.force && !record.run.controls.cancelable) {
      return false
    }

    if (record.run.status === 'cancelling') {
      return false
    }

    const requestedAt = Date.now()
    if (!record.controller.signal.aborted) {
      record.controller.abort()
    }
    record.pause?.resolve()
    record.pause = undefined

    if (record.run.status === 'queued') {
      if (options.emitRequest) {
        this.emitCancelRequested(record, requestedAt)
      }
      this.finishRecord(record, 'cancelled', { summary: 'Task run was cancelled.' })
      return true
    }

    this.transition(record, 'cancelling', requestedAt)
    this.flushNow(record)

    if (options.emitRequest) {
      this.emitCancelRequested(record, requestedAt)
    }

    log.info('Task run cancel requested.', { runId: record.run.id })
    return true
  }

  private emitCancelRequested(record: ActiveTaskRunRecord, requestedAt: number): void {
    const request = {
      runId: record.run.id,
      run: cloneTaskRun(record.run),
      requestedAt
    }

    for (const listener of this.cancelListeners) {
      try {
        listener(request)
      } catch (error) {
        log.warn('Task run cancel listener failed.', error, { runId: record.run.id })
      }
    }
  }

  private finish(
    runId: string,
    status: TaskRunFinalStatus,
    result: Omit<TaskRunResult, 'status'> = {}
  ): void {
    this.finishRecord(this.requireRecord(runId), status, result)
  }

  private finishRecord(
    record: ActiveTaskRunRecord,
    status: TaskRunFinalStatus,
    result: Omit<TaskRunResult, 'status'>
  ): void {
    const now = Date.now()
    assertTaskRunTransition(record.run.status, status)
    record.pause?.resolve()
    record.pause = undefined
    this.clearPendingProgressFlush(record.run.id)

    record.run = {
      ...record.run,
      status,
      result: createFinalResult(status, result, record.run.progress),
      updatedAt: now,
      finishedAt: now
    }

    try {
      this.options.history.saveFinal(record.run)
      this.options.history.prune()
    } catch (error) {
      log.error('Failed to persist task run history.', error, { runId: record.run.id })
    }

    this.flushNow(record)
    this.active.delete(record.run.id)

    const finalSnapshot = cloneTaskRun(record.run)
    for (const waiter of record.waiters) {
      waiter.resolve(finalSnapshot)
    }
    record.waiters.length = 0

    log.info('Task run finished.', { runId: record.run.id, status })
  }

  private transition(record: ActiveTaskRunRecord, status: TaskRunStatus, updatedAt = Date.now()) {
    assertTaskRunTransition(record.run.status, status)
    record.run = {
      ...record.run,
      status,
      updatedAt
    }
  }

  private scheduleProgressFlush(record: ActiveTaskRunRecord): void {
    const now = Date.now()
    const elapsed = now - record.lastFlushedAt
    if (elapsed >= PROGRESS_FLUSH_MAX_DELAY_MS) {
      this.flushNow(record)
      return
    }

    if (this.progressTimers.has(record.run.id)) {
      return
    }

    const delayMs = Math.min(PROGRESS_FLUSH_INTERVAL_MS, PROGRESS_FLUSH_MAX_DELAY_MS - elapsed)
    const timer = setTimeout(() => {
      this.progressTimers.delete(record.run.id)
      const latest = this.active.get(record.run.id)
      if (latest) {
        this.flushNow(latest)
      }
    }, delayMs)
    this.progressTimers.set(record.run.id, timer)
  }

  private flushNow(record: ActiveTaskRunRecord): void {
    this.clearPendingProgressFlush(record.run.id)
    record.lastFlushedAt = Date.now()
    const snapshot = cloneTaskRun(record.run)
    this.options.ipc.send('task-run:changed', snapshot)
    this.options.notifications.handleChanged(snapshot, record.presentation)
  }

  private clearPendingProgressFlush(runId: string): void {
    const timer = this.progressTimers.get(runId)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    this.progressTimers.delete(runId)
  }
}

function isCancellingStatus(status: TaskRunStatus): boolean {
  return status === 'cancelling'
}

async function waitForResumeOrAbort(
  context: TaskRunContext,
  resumePromise: Promise<void>
): Promise<void> {
  if (context.signal.aborted) {
    throw new TaskRunCancellation()
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(new TaskRunCancellation())
    context.signal.addEventListener('abort', onAbort, { once: true })
    resumePromise.then(resolve, reject).finally(() => {
      context.signal.removeEventListener('abort', onAbort)
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
