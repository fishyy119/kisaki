import type { I18nService } from '@main/services/i18n'
import type { TaskRunContext } from '@main/services/task-run'
import type { Semaphore } from '@main/utils/async'
import {
  isActiveScannerRunStatus,
  type ScannerRunState,
  type ScannerRunStatus
} from '@shared/scanner'
import type { TaskRunStatus } from '@shared/task-run'
import { toTaskRunProgressUpdate } from './projection'
import type { ScannerRunStateStore } from './state'
import type { ActiveScannerRun, ScannerEntityProcessResult } from './types'

export class ScannerRunSession {
  private indeterminate = true

  constructor(
    private readonly record: ActiveScannerRun,
    private readonly states: ScannerRunStateStore,
    private readonly context: TaskRunContext,
    private readonly options: {
      i18n: I18nService
      publish: (record: ActiveScannerRun) => void
      readTaskRunStatus: (runId: string) => TaskRunStatus | null
    }
  ) {}

  get scannerId(): string {
    return this.record.state.scannerId
  }

  get state(): Readonly<ScannerRunState> {
    return this.record.state
  }

  get signal(): AbortSignal {
    return this.context.signal
  }

  start(): void {
    this.updateState({
      status: 'running',
      phase: 'preparing',
      message: this.options.i18n.messages.scanner.run.preparing,
      startedAt: this.record.state.startedAt ?? Date.now()
    })
    this.reportTaskRunProgress()
  }

  reportPhase(phase: string, message?: string, indeterminate = false): void {
    this.indeterminate = indeterminate
    this.updateState({
      phase,
      message: message ?? phase
    })
    this.reportTaskRunProgress()
  }

  setTotal(total: number): void {
    this.indeterminate = false
    this.updateState({ total })
    this.reportTaskRunProgress()
  }

  recordEntityResult(result: ScannerEntityProcessResult): void {
    this.record.state = this.states.recordEntityResult(this.record.state.scannerId, result)
    this.publish()
    this.reportTaskRunProgress()
  }

  async checkpoint(): Promise<void> {
    await this.pauseOrCancelAtBoundary()
  }

  /**
   * Process items with pause/cancel checkpoints at entity boundaries.
   *
   * The limiter is the application-wide entity budget shared by every scan
   * run: each item acquires one permit before it starts, so concurrent runs
   * split the same total instead of multiplying it. While the acquire waits,
   * in-flight items keep running and a cancellation aborts the wait.
   */
  async processItems<T>(
    items: readonly T[],
    limiter: Semaphore,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    const activeTasks = new Set<Promise<void>>()
    let nextIndex = 0
    let pendingError: { error: unknown } | null = null

    while (nextIndex < items.length || activeTasks.size > 0) {
      if (pendingError) break

      if (this.hasCancelRequest()) {
        this.setStatus('cancelling')
        if (activeTasks.size > 0) {
          await Promise.race(activeTasks)
          continue
        }
        await this.context.checkpoint()
      }

      if (this.hasPauseRequest()) {
        if (activeTasks.size > 0) {
          this.setStatus('pausing')
          await Promise.race(activeTasks)
          continue
        }
        await this.pauseOrCancelAtBoundary()
        continue
      }

      if (nextIndex >= items.length) {
        await Promise.race(activeTasks)
        continue
      }

      try {
        await limiter.acquire(this.signal)
      } catch (error) {
        pendingError = { error }
        break
      }

      const currentItem = items[nextIndex]
      nextIndex++

      // Worker failures (cancellation rethrows) are captured instead of
      // rejecting the task, so sibling entities always drain before the
      // error surfaces and no rejection goes unobserved.
      const task = worker(currentItem)
        .catch((error: unknown) => {
          pendingError ??= { error }
        })
        .finally(() => {
          limiter.release()
          activeTasks.delete(task)
        })
      activeTasks.add(task)
    }

    while (activeTasks.size > 0) {
      await Promise.race(activeTasks)
    }

    if (pendingError) {
      throw pendingError.error
    }

    await this.pauseOrCancelAtBoundary()
  }

  private async pauseOrCancelAtBoundary(): Promise<void> {
    if (this.hasCancelRequest()) {
      this.setStatus('cancelling')
      await this.context.checkpoint()
    }

    if (this.hasPauseRequest()) {
      this.setStatus('paused')
      await this.context.checkpoint()
      if (!this.hasCancelRequest() && isActiveScannerRunStatus(this.record.state.status)) {
        this.setStatus('running')
      }
      return
    }

    await this.context.checkpoint()
  }

  private hasPauseRequest(): boolean {
    const taskRunStatus = this.options.readTaskRunStatus(this.record.state.runId)
    return taskRunStatus === 'pausing' || taskRunStatus === 'paused'
  }

  private hasCancelRequest(): boolean {
    const taskRunStatus = this.options.readTaskRunStatus(this.record.state.runId)
    return this.context.signal.aborted || taskRunStatus === 'cancelling'
  }

  private setStatus(status: ScannerRunStatus): void {
    if (this.record.state.status === status) {
      return
    }
    this.updateState({ status })
  }

  private updateState(patch: Partial<ScannerRunState>): void {
    this.record.state = this.states.patch(this.record.state.scannerId, patch)
    this.publish()
  }

  private publish(): void {
    this.options.publish(this.record)
  }

  private reportTaskRunProgress(): void {
    this.context.report(toTaskRunProgressUpdate(this.record.state, this.indeterminate))
  }
}
