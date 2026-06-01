import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import type { TaskRunInitiator, TaskRunStatus } from '@shared/task-run'
import {
  toTaskRunCounters,
  toTaskRunOutput,
  toTaskRunSummary,
  toTaskRunWarnings
} from './projection'
import type { ActiveScannerRun, ScannerRunMetadata } from './types'

export class ScannerTaskRunBridge<TScanner extends ScannerRunMetadata> {
  constructor(private readonly service: TaskRunService) {}

  create(scanner: TScanner, initiator: TaskRunInitiator): TaskRunHandle {
    return this.service.runs.create({
      category: 'scanner',
      operation: 'scanner.scan',
      title: `扫描 ${scanner.name}`,
      description: scanner.path,
      owner: { type: 'app' },
      initiator,
      subject: { type: 'scanner', id: scanner.id, labelSnapshot: scanner.name },
      controls: { cancelable: true, pausable: true }
    })
  }

  readStatus(runId: string): TaskRunStatus | null {
    return this.service.runs.get(runId)?.status ?? null
  }

  start(record: ActiveScannerRun<TScanner>): void {
    record.taskRun.start()
  }

  pause(record: ActiveScannerRun<TScanner>): boolean {
    return this.service.runs.pause(record.taskRun.id)
  }

  resume(record: ActiveScannerRun<TScanner>): boolean {
    return this.service.runs.resume(record.taskRun.id)
  }

  requestCancel(record: ActiveScannerRun<TScanner>): boolean {
    return this.service.runs.cancel(record.taskRun.id)
  }

  complete(record: ActiveScannerRun<TScanner>): void {
    record.taskRun.complete({
      summary: toTaskRunSummary('completed', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('completed', record.state)
    })
  }

  fail(record: ActiveScannerRun<TScanner>, error: unknown): void {
    record.taskRun.fail(error, {
      summary: toTaskRunSummary('failed', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('failed', record.state)
    })
  }

  finishCancelled(record: ActiveScannerRun<TScanner>): void {
    record.taskRun.cancel({
      summary: toTaskRunSummary('cancelled', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('cancelled', record.state)
    })
  }

  onCancelRequested(listener: (runId: string) => void): () => void {
    return this.service.runs.onCancelRequested((request) => listener(request.runId))
  }
}
