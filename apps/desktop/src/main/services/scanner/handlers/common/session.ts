import type { TaskRunContext } from '@main/services/task-run'
import {
  isActiveScannerRunStatus,
  type ScannerRunState,
  type ScannerRunStatus
} from '@shared/scanner'
import type { TaskRunStatus } from '@shared/task-run'
import { toTaskRunProgressUpdate } from './projection'
import type { ScannerRunStateStore } from './state'
import type { ActiveScannerRun, ScannerEntityProcessResult, ScannerRunMetadata } from './types'

export class ScannerRunSession<TScanner extends ScannerRunMetadata> {
  private indeterminate = true

  constructor(
    private readonly record: ActiveScannerRun<TScanner>,
    private readonly states: ScannerRunStateStore<TScanner>,
    private readonly context: TaskRunContext,
    private readonly options: {
      publish: (record: ActiveScannerRun<TScanner>) => void
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

  setScanner(scanner: TScanner): void {
    this.record.scanner = scanner
    this.updateState({
      scannerName: scanner.name,
      mediaType: scanner.type,
      path: scanner.path
    })
  }

  start(): void {
    this.updateState({
      status: 'running',
      phase: 'preparing',
      message: '准备扫描',
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

  async processItemsWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    const workerCount = Math.min(items.length, Math.max(1, concurrency))
    if (workerCount === 0) {
      await this.pauseOrCancelAtBoundary()
      return
    }

    const activeTasks = new Set<Promise<void>>()
    let nextIndex = 0

    const scheduleTasks = async (): Promise<void> => {
      while (
        nextIndex < items.length &&
        activeTasks.size < workerCount &&
        !this.hasPauseRequest() &&
        !this.hasCancelRequest()
      ) {
        await this.context.checkpoint()
        const currentItem = items[nextIndex]
        nextIndex++

        const task = worker(currentItem).finally(() => {
          activeTasks.delete(task)
        })
        activeTasks.add(task)
      }
    }

    while (nextIndex < items.length || activeTasks.size > 0) {
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

      await scheduleTasks()

      if (activeTasks.size === 0) {
        continue
      }

      await Promise.race(activeTasks)
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
