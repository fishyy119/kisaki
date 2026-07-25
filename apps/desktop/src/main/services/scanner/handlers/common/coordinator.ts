import type { EventService } from '@main/services/event'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { TaskRunService } from '@main/services/task-run'
import { isTaskRunCancellation } from '@main/services/task-run'
import type { ScannerFinishedStatus } from '@shared/events/library'
import type {
  ScanCompletedData,
  ScannerRunStartResult,
  ScannerRunState,
  ScannerRunStatus
} from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import { toScanCompletedData, toScannerStats } from './projection'
import { ScannerRunSession } from './session'
import { cloneScannerRunState, ScannerRunStateStore } from './state'
import { ScannerTaskRunBridge } from './task-run'
import type { ActiveScannerRun, ScannerRunMetadata } from './types'

type Awaitable<T> = T | Promise<T>

export interface ScannerRunCoordinatorOptions<TScanner extends ScannerRunMetadata> {
  ipc: IpcService
  taskRun: TaskRunService
  eventService: EventService
  i18n: I18nService
  loadScanner: (scannerId: string) => Awaitable<TScanner>
  runScan: (scanner: TScanner, session: ScannerRunSession<TScanner>) => Awaitable<void>
}

interface ScannerRunQueueItem {
  scannerId: string
  resolve: (value: ScanCompletedData) => void
  reject: (reason: unknown) => void
}

export class ScannerRunCoordinator<TScanner extends ScannerRunMetadata> {
  private readonly activeRuns = new Map<string, ActiveScannerRun<TScanner>>()
  private readonly queue: ScannerRunQueueItem[] = []
  private readonly states = new ScannerRunStateStore<TScanner>()
  private readonly taskRuns: ScannerTaskRunBridge<TScanner>
  private readonly unsubscribeCancel: () => void
  private isProcessingQueue = false

  constructor(private readonly options: ScannerRunCoordinatorOptions<TScanner>) {
    this.taskRuns = new ScannerTaskRunBridge(options.taskRun, options.i18n)
    this.unsubscribeCancel = this.taskRuns.onCancelRequested((runId) => {
      this.handleTaskRunCancelRequested(runId)
    })
  }

  listRunStates(): ScannerRunState[] {
    return this.states.list()
  }

  async startScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<{ start: ScannerRunStartResult; completed: Promise<ScanCompletedData> }> {
    if (this.activeRuns.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is already queued or running`)
    }

    const scanner = await this.options.loadScanner(scannerId)
    const taskRun = this.taskRuns.create(scanner, initiator)
    const record: ActiveScannerRun<TScanner> = {
      scanner,
      taskRun,
      state: this.states.create(scanner, taskRun)
    }

    this.activeRuns.set(scanner.id, record)
    this.publishStateChanged(record)

    const completed = new Promise<ScanCompletedData>((resolve, reject) => {
      this.queue.push({ scannerId: scanner.id, resolve, reject })
      void this.processQueue()
    })

    return {
      start: { runId: taskRun.id, createdAt: taskRun.createdAt },
      completed
    }
  }

  async runScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScanCompletedData> {
    const { completed } = await this.startScanner(scannerId, initiator)
    return completed
  }

  pauseScanner(scannerId: string): boolean {
    const record = this.activeRuns.get(scannerId)
    if (!record) {
      return false
    }

    const accepted = this.taskRuns.pause(record)
    if (accepted && record.state.status === 'running') {
      this.updateState(record, { status: 'pausing' })
    }
    return accepted
  }

  resumeScanner(scannerId: string): boolean {
    const record = this.activeRuns.get(scannerId)
    if (!record) {
      return false
    }

    const accepted = this.taskRuns.resume(record)
    if (accepted && (record.state.status === 'pausing' || record.state.status === 'paused')) {
      this.updateState(record, { status: 'running' })
    }
    return accepted
  }

  cancelScanner(scannerId: string): boolean {
    const record = this.activeRuns.get(scannerId)
    return record ? this.taskRuns.requestCancel(record) : false
  }

  cleanup(): void {
    const activeRuns = [...this.activeRuns.values()]
    for (const record of activeRuns) {
      this.taskRuns.requestCancel(record)
    }

    this.unsubscribeCancel()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()
        if (!item) break

        try {
          const result = await this.executeQueuedScan(item)
          item.resolve(result)
        } catch (error) {
          item.reject(error)
        }
      }
    } finally {
      this.isProcessingQueue = false

      if (this.queue.length > 0) {
        void this.processQueue()
      }
    }
  }

  private async executeQueuedScan(item: ScannerRunQueueItem): Promise<ScanCompletedData> {
    const record = this.requireActiveRun(item.scannerId)

    try {
      this.taskRuns.start(record)
      const session = new ScannerRunSession(record, this.states, record.taskRun.context, {
        i18n: this.options.i18n,
        publish: (nextRecord) => this.publishStateChanged(nextRecord),
        readTaskRunStatus: (runId) => this.taskRuns.readStatus(runId)
      })
      session.start()

      const scanner = await this.options.loadScanner(item.scannerId)
      session.setScanner(scanner)
      this.options.eventService.bus.emit(
        'scanner.started',
        { local: true },
        { scannerId: scanner.id, scannerName: scanner.name }
      )
      await this.options.runScan(scanner, session)
      session.reportPhase('finished', this.options.i18n.messages.scanner.run.finished)

      const result = this.finishRecord(record, 'completed')
      this.taskRuns.complete(record)
      this.emitFinished(record, 'completed', result)
      return result
    } catch (error) {
      if (isTaskRunCancellation(error) || record.taskRun.context.signal.aborted) {
        const result = this.finishRecord(record, 'cancelled')
        this.taskRuns.finishCancelled(record)
        this.emitFinished(record, 'cancelled', result)
        return result
      }

      const result = this.finishRecord(record, 'failed')
      this.taskRuns.fail(record, error)
      this.options.eventService.bus.emit(
        'scanner.finished',
        { local: true },
        {
          scannerId: record.state.scannerId,
          scannerName: record.state.scannerName,
          status: 'failed',
          stats: toScannerStats(result),
          error: error instanceof Error ? error.message : String(error)
        }
      )
      throw error
    }
  }

  private handleTaskRunCancelRequested(runId: string): void {
    const record = this.findActiveRunByTaskRunId(runId)
    if (!record) {
      return
    }

    const queuedIndex = this.queue.findIndex((item) => item.scannerId === record.state.scannerId)
    if (queuedIndex >= 0) {
      const [item] = this.queue.splice(queuedIndex, 1)
      const result = this.finishRecord(record, 'cancelled')
      this.emitFinished(record, 'cancelled', result)
      item.resolve(result)
      return
    }

    if (record.state.status !== 'cancelling') {
      this.updateState(record, { status: 'cancelling' })
    }
  }

  private finishRecord(
    record: ActiveScannerRun<TScanner>,
    status: Extract<ScannerRunStatus, 'completed' | 'failed' | 'cancelled'>
  ): ScanCompletedData {
    this.updateState(record, {
      status,
      finishedAt: Date.now()
    })
    this.activeRuns.delete(record.state.scannerId)
    return toScanCompletedData(record.state)
  }

  private emitFinished(
    record: ActiveScannerRun<TScanner>,
    status: ScannerFinishedStatus,
    result: ScanCompletedData
  ): void {
    this.options.eventService.bus.emit(
      'scanner.finished',
      { local: true },
      {
        scannerId: result.scannerId,
        scannerName: result.scannerName || record.scanner.name,
        status,
        stats: toScannerStats(result)
      }
    )
  }

  private requireActiveRun(scannerId: string): ActiveScannerRun<TScanner> {
    const record = this.activeRuns.get(scannerId)
    if (!record) {
      throw new Error(`Scanner ${scannerId} is not active`)
    }
    return record
  }

  private findActiveRunByTaskRunId(runId: string): ActiveScannerRun<TScanner> | undefined {
    return [...this.activeRuns.values()].find((record) => record.taskRun.id === runId)
  }

  private updateState(record: ActiveScannerRun<TScanner>, patch: Partial<ScannerRunState>): void {
    record.state = this.states.patch(record.state.scannerId, patch)
    this.publishStateChanged(record)
  }

  private publishStateChanged(record: ActiveScannerRun<TScanner>): void {
    this.options.ipc.send('scanner:run-state-changed', cloneScannerRunState(record.state))
  }
}
