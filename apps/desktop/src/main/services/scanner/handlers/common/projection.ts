import type { ScannerFinishedStatus } from '@shared/events/library'
import type { Messages } from '@shared/i18n'
import type { ScanCompletedData, ScannerRunState, ScannerRunStatus } from '@shared/scanner'
import type { TaskRunProgressUpdate } from '@shared/task-run'

const TASK_RUN_PROGRESS_WARNING_LIMIT = 20
const SCANNER_PHASE_TOTAL = 3

export function toScanCompletedData(state: ScannerRunState): ScanCompletedData {
  return {
    scannerId: state.scannerId,
    scannerName: state.scannerName,
    mediaType: state.mediaType,
    path: state.path,
    status: toScanCompletedStatus(state.status),
    total: state.total,
    processedCount: state.processedCount,
    newCount: state.newCount,
    existingCount: state.existingCount,
    failedCount: state.failedCount,
    issueCount: state.issueCount,
    issues: state.issues.map((issue) => ({ ...issue })),
    existing: state.existing.map((existing) => ({ ...existing }))
  }
}

export function toScannerStats(source: {
  total: number
  processedCount: number
  newCount: number
  existingCount: number
  failedCount: number
  issueCount: number
}): Record<string, number> {
  return {
    total: source.total,
    processedCount: source.processedCount,
    newCount: source.newCount,
    existingCount: source.existingCount,
    failedCount: source.failedCount,
    issueCount: source.issueCount
  }
}

export function toTaskRunCounters(state: ScannerRunState): Record<string, number> {
  return {
    total: state.total,
    processed: state.processedCount,
    new: state.newCount,
    existing: state.existingCount,
    failed: state.failedCount,
    issues: state.issueCount
  }
}

export function toTaskRunWarnings(state: ScannerRunState) {
  if (state.issues.length === 0) {
    return undefined
  }

  return state.issues
    .map((issue) => ({
      code: `scanner.issue.${issue.type}`,
      message: `${issue.extractedName}: ${issue.reason}`
    }))
    .slice(0, TASK_RUN_PROGRESS_WARNING_LIMIT)
}

export function toTaskRunSummary(
  messages: Messages,
  status: ScannerFinishedStatus,
  state: ScannerRunState
): string {
  const prefix =
    status === 'completed'
      ? messages.scanner.run.resultCompleted
      : status === 'cancelled'
        ? messages.scanner.run.resultCancelled
        : messages.scanner.run.resultFailed
  return messages.scanner.run.resultSummary({
    status: prefix,
    processed: state.processedCount,
    total: state.total,
    added: state.newCount,
    existing: state.existingCount,
    failed: state.failedCount,
    issues: state.issueCount
  })
}

export function toTaskRunOutput(status: ScannerFinishedStatus, state: ScannerRunState) {
  return {
    scannerId: state.scannerId,
    scannerName: state.scannerName,
    mediaType: state.mediaType,
    path: state.path,
    status,
    total: state.total,
    processedCount: state.processedCount,
    newCount: state.newCount,
    existingCount: state.existingCount,
    failedCount: state.failedCount,
    issueCount: state.issueCount
  }
}

export function toTaskRunProgressUpdate(
  state: ScannerRunState,
  indeterminate: boolean
): TaskRunProgressUpdate {
  const update: TaskRunProgressUpdate = {
    phase: toTaskRunPhase(state.phase, state.message),
    counters: toTaskRunCounters(state),
    warnings: toTaskRunWarnings(state)
  }

  if (!indeterminate) {
    update.work = {
      current: Math.min(state.processedCount, state.total),
      total: state.total,
      unit: 'entity'
    }
  }

  return update
}

function toTaskRunPhase(phase: string | undefined, label: string | undefined) {
  if (!phase) {
    return undefined
  }

  const current = getScannerPhaseCurrent(phase)
  return {
    key: phase,
    label: label ?? phase,
    current,
    total: current === undefined ? undefined : SCANNER_PHASE_TOTAL
  }
}

function getScannerPhaseCurrent(phase: string): number | undefined {
  switch (phase) {
    case 'preparing':
      return 1
    case 'discovering':
      return 2
    case 'processing':
    case 'finished':
      return 3
    default:
      return undefined
  }
}

function toScanCompletedStatus(status: ScannerRunStatus): ScanCompletedData['status'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      throw new Error(`Scanner run status "${status}" is not final.`)
  }
}
