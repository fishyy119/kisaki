import type { I18nService } from '@main/services/i18n'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import type { Scanner } from '@shared/db'
import type { TaskRunInitiator, TaskRunStatus } from '@shared/task-run'
import {
  toTaskRunCounters,
  toTaskRunOutput,
  toTaskRunSummary,
  toTaskRunWarnings
} from './projection'
import type { ActiveScannerRun } from './types'

export class ScannerTaskRunBridge {
  constructor(
    private readonly service: TaskRunService,
    private readonly i18n: I18nService
  ) {}

  create(scanner: Scanner, initiator: TaskRunInitiator): TaskRunHandle {
    return this.service.runs.create({
      category: 'scanner',
      operation: 'scanner.scan',
      title: this.i18n.messages.scanner.run.title({ name: scanner.name }),
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

  start(record: ActiveScannerRun): void {
    record.taskRun.start()
  }

  pause(record: ActiveScannerRun): boolean {
    return this.service.runs.pause(record.taskRun.id)
  }

  resume(record: ActiveScannerRun): boolean {
    return this.service.runs.resume(record.taskRun.id)
  }

  requestCancel(record: ActiveScannerRun): boolean {
    return this.service.runs.cancel(record.taskRun.id)
  }

  complete(record: ActiveScannerRun): void {
    record.taskRun.complete({
      summary: toTaskRunSummary(this.i18n.messages, 'completed', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('completed', record.state)
    })
  }

  fail(record: ActiveScannerRun, error: unknown): void {
    record.taskRun.fail(error, {
      summary: toTaskRunSummary(this.i18n.messages, 'failed', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('failed', record.state)
    })
  }

  finishCancelled(record: ActiveScannerRun): void {
    record.taskRun.cancel({
      summary: toTaskRunSummary(this.i18n.messages, 'cancelled', record.state),
      counters: toTaskRunCounters(record.state),
      warnings: toTaskRunWarnings(record.state),
      output: toTaskRunOutput('cancelled', record.state)
    })
  }

  onCancelRequested(listener: (runId: string) => void): () => void {
    return this.service.runs.onCancelRequested((request) => listener(request.runId))
  }
}
