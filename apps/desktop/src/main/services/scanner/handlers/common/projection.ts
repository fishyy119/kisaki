import type { ScannerFinishedStatus } from '@shared/events/library'
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
    skippedCount: state.skippedCount,
    failedCount: state.failedCount,
    skippedScans: [...state.skippedScans],
    failedScans: [...state.failedScans]
  }
}

export function toScannerStats(source: {
  total: number
  processedCount: number
  newCount: number
  skippedCount: number
  failedCount: number
}): Record<string, number> {
  return {
    total: source.total,
    processedCount: source.processedCount,
    newCount: source.newCount,
    skippedCount: source.skippedCount,
    failedCount: source.failedCount
  }
}

export function toTaskRunCounters(state: ScannerRunState): Record<string, number> {
  return {
    total: state.total,
    processed: state.processedCount,
    new: state.newCount,
    skipped: state.skippedCount,
    failed: state.failedCount
  }
}

export function toTaskRunWarnings(state: ScannerRunState) {
  if (state.failedScans.length === 0) {
    return undefined
  }

  return state.failedScans.slice(0, TASK_RUN_PROGRESS_WARNING_LIMIT).map((failedScan) => ({
    code: 'scanner.failed',
    message: `${failedScan.name}: ${failedScan.reason}`
  }))
}

export function toTaskRunSummary(status: ScannerFinishedStatus, state: ScannerRunState): string {
  const prefix =
    status === 'completed' ? '扫描完成' : status === 'cancelled' ? '扫描已取消' : '扫描失败'
  return `${prefix}：处理 ${state.processedCount}/${state.total}，新增 ${state.newCount}，跳过 ${state.skippedCount}，失败 ${state.failedCount}`
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
    skippedCount: state.skippedCount,
    failedCount: state.failedCount
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
