import type { ExternalId } from '@shared/identity'
import type { TaskRunContext } from '@main/services/task-run'
import type { TaskRunWarning } from '@shared/task-run'

export interface IngestBatchUpdateRow {
  id: string
  name: string
  originalName: string | null
  externalIds: ExternalId[]
}

export interface IngestBatchFailure {
  entityId?: string
  name?: string
  error: string
}

export interface IngestBatchItemWarning {
  entityId?: string
  name?: string
  code?: string
  message: string
}

export interface IngestBatchResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  failures: IngestBatchFailure[]
  warnings: IngestBatchItemWarning[]
}

export interface IngestBatchCounters {
  [key: string]: number
  succeeded: number
  failed: number
  skipped: number
  warnings: number
}

export const BATCH_FAILURE_LIMIT = 200
export const BATCH_WARNING_LIMIT = 200
export const BATCH_PROGRESS_WARNING_LIMIT = 20

export function getBatchRowQueryName(row: IngestBatchUpdateRow): string {
  return row.originalName || row.name
}

export function getSafeBatchError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function pushBoundedFailure(
  failures: IngestBatchFailure[],
  failure: IngestBatchFailure
): void {
  if (failures.length < BATCH_FAILURE_LIMIT) {
    failures.push(failure)
  }
}

export function pushBoundedItemWarning(
  warnings: IngestBatchItemWarning[],
  warning: IngestBatchItemWarning
): void {
  if (warnings.length < BATCH_WARNING_LIMIT) {
    warnings.push(warning)
  }
}

export function createBatchTaskRunWarnings(
  failures: readonly IngestBatchFailure[],
  itemWarnings: readonly IngestBatchItemWarning[],
  limit = BATCH_PROGRESS_WARNING_LIMIT
): TaskRunWarning[] {
  return [
    ...failures.map((failure) => ({
      code: 'item-failed',
      message: `${failure.name ?? failure.entityId ?? '项目'}：${failure.error}`
    })),
    ...itemWarnings.map((warning) => ({
      code: warning.code,
      message: `${warning.name ?? warning.entityId ?? '项目'}：${warning.message}`
    }))
  ].slice(-limit)
}

export function reportBatchProgress(params: {
  context: TaskRunContext
  phase: 'searching' | 'updating'
  label?: string
  current: number
  total: number
  counters: IngestBatchCounters
  failures: readonly IngestBatchFailure[]
  itemWarnings: readonly IngestBatchItemWarning[]
}): void {
  params.context.report({
    phase: {
      key: params.phase,
      label: params.label ?? getBatchProgressPhaseLabel(params.phase),
      current: params.phase === 'searching' ? 1 : 2,
      total: 2
    },
    work: {
      current: params.current,
      total: params.total,
      unit: 'entity'
    },
    counters: { ...params.counters },
    warnings: createBatchTaskRunWarnings(params.failures, params.itemWarnings)
  })
}

function getBatchProgressPhaseLabel(phase: 'searching' | 'updating'): string {
  switch (phase) {
    case 'searching':
      return '正在匹配远端条目'
    case 'updating':
      return '正在更新本地元数据'
  }
}
