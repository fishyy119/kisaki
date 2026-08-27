import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { TaskRunService } from '@main/services/task-run'
import { isCancellation } from '@main/services/task-run'
import type { Scanner } from '@shared/db'
import type {
  ScanCompletedData,
  ScannerRunFinishedStatus,
  ScannerRunStartResult,
  ScannerRunState,
  ScannerRunStatus
} from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import type { ScannerHooks } from '../hooks'
import { toScanCompletedData, toScannerStats } from './projection'
import { ScannerRunSession } from './session'
import { cloneScannerRunState, ScannerRunStateStore } from './state'
import { ScannerTaskRunBridge } from './task-run'
import type { ActiveScannerRun } from './types'

export interface ScannerRunCoordinatorOptions {
  ipc: IpcService
  taskRun: TaskRunService
  hooks: ScannerHooks
  i18n: I18nService
  loadScanner: (scannerId: string) => Scanner
  runScan: (scanner: Scanner, session: ScannerRunSession) => Promise<void>
}

export interface ScannerRunStart {
  start: ScannerRunStartResult
  completed: Promise<ScanCompletedData>
}

export class ScannerRunCoordinator {
  private readonly activeRuns = new Map<string, ActiveScannerRun>()
  private readonly states = new ScannerRunStateStore()
  private readonly taskRuns: ScannerTaskRunBridge
  private readonly unsubscribeCancel: () => void

  constructor(private readonly options: ScannerRunCoordinatorOptions) {
    this.taskRuns = new ScannerTaskRunBridge(options.taskRun, options.i18n)
    this.unsubscribeCancel = this.taskRuns.onCancelRequested((runId) => {
      this.handleTaskRunCancelRequested(runId)
    })
  }

  listRunStates(): ScannerRunState[] {
    return this.states.list()
  }

  /**
   * Creates the run and starts executing immediately.
   *
   * Runs are not queued: the global entity semaphore is the only throttle, so
   * `queued` exists only for the instant between creation and start. The
   * synchronous load-and-register leaves no await between the duplicate check
   * and the reservation.
   */
  startScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): ScannerRunStart {
    if (this.activeRuns.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is already running`)
    }

    const scanner = this.options.loadScanner(scannerId)
    const taskRun = this.taskRuns.create(scanner, initiator)
    const record: ActiveScannerRun = {
      scanner,
      taskRun,
      state: this.states.create(scanner, taskRun)
    }

    this.activeRuns.set(scanner.id, record)
    this.publishStateChanged(record)

    return {
      start: { runId: taskRun.id, createdAt: taskRun.createdAt },
      completed: this.executeScan(record)
    }
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
    for (const record of [...this.activeRuns.values()]) {
      this.taskRuns.requestCancel(record)
    }

    this.unsubscribeCancel()
  }

  private async executeScan(record: ActiveScannerRun): Promise<ScanCompletedData> {
    try {
      this.taskRuns.start(record)
      const session = new ScannerRunSession(record, this.states, record.taskRun.context, {
        i18n: this.options.i18n,
        publish: (nextRecord) => this.publishStateChanged(nextRecord),
        readTaskRunStatus: (runId) => this.taskRuns.readStatus(runId)
      })
      session.start()

      this.options.hooks.runStarted.dispatch({
        scannerId: record.scanner.id,
        scannerName: record.scanner.name
      })
      await this.options.runScan(record.scanner, session)
      session.reportPhase('finished', this.options.i18n.messages.scanner.run.finished)

      const result = this.finishRecord(record, 'completed')
      this.taskRuns.complete(record)
      this.emitFinished(record, 'completed', result)
      return result
    } catch (error) {
      if (isCancellation(error) || record.taskRun.context.signal.aborted) {
        const result = this.finishRecord(record, 'cancelled')
        this.taskRuns.finishCancelled(record)
        this.emitFinished(record, 'cancelled', result)
        return result
      }

      const result = this.finishRecord(record, 'failed')
      this.taskRuns.fail(record, error)
      this.options.hooks.runFinished.dispatch({
        scannerId: record.state.scannerId,
        scannerName: record.state.scannerName,
        status: 'failed',
        stats: toScannerStats(result),
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  private handleTaskRunCancelRequested(runId: string): void {
    const record = [...this.activeRuns.values()].find((candidate) => candidate.taskRun.id === runId)
    if (record && record.state.status !== 'cancelling') {
      this.updateState(record, { status: 'cancelling' })
    }
  }

  private finishRecord(
    record: ActiveScannerRun,
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
    record: ActiveScannerRun,
    status: ScannerRunFinishedStatus,
    result: ScanCompletedData
  ): void {
    this.options.hooks.runFinished.dispatch({
      scannerId: result.scannerId,
      scannerName: result.scannerName || record.scanner.name,
      status,
      stats: toScannerStats(result)
    })
  }

  private updateState(record: ActiveScannerRun, patch: Partial<ScannerRunState>): void {
    record.state = this.states.patch(record.state.scannerId, patch)
    this.publishStateChanged(record)
  }

  private publishStateChanged(record: ActiveScannerRun): void {
    this.options.ipc.send('scanner:run-state-changed', cloneScannerRunState(record.state))
  }
}
