/**
 * Batch progress and failure reporting.
 *
 * Failure and warning lists are bounded because a batch can cover thousands of
 * entities and both lists end up in task-run output and IPC payloads.
 */

import type { TaskRunContext } from '@main/services/task-run'
import type { Messages } from '@shared/i18n'
import type { TaskRunWarning } from '@shared/task-run'
import type {
  IngestBatchCounters,
  IngestBatchFailure,
  IngestBatchItemWarning,
  IngestBatchPhase,
  IngestBatchUpdateRow
} from './types'

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
  messages: Messages,
  failures: readonly IngestBatchFailure[],
  itemWarnings: readonly IngestBatchItemWarning[],
  limit = BATCH_PROGRESS_WARNING_LIMIT
): TaskRunWarning[] {
  const fallbackLabel = messages.ingest.batch.fallbackItemLabel
  return [
    ...failures.map((failure) => ({
      code: 'item-failed',
      message: messages.ingest.batch.itemMessage({
        name: failure.name ?? failure.entityId ?? fallbackLabel,
        detail: failure.error
      })
    })),
    ...itemWarnings.map((warning) => ({
      code: warning.code,
      message: messages.ingest.batch.itemMessage({
        name: warning.name ?? warning.entityId ?? fallbackLabel,
        detail: warning.message
      })
    }))
  ].slice(-limit)
}

export function reportBatchProgress(params: {
  messages: Messages
  context: TaskRunContext
  phase: IngestBatchPhase
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
      label: params.label ?? getBatchProgressPhaseLabel(params.messages, params.phase),
      current: params.phase === 'searching' ? 1 : 2,
      total: 2
    },
    work: {
      current: params.current,
      total: params.total,
      unit: 'entity'
    },
    counters: { ...params.counters },
    warnings: createBatchTaskRunWarnings(params.messages, params.failures, params.itemWarnings)
  })
}

function getBatchProgressPhaseLabel(messages: Messages, phase: IngestBatchPhase): string {
  switch (phase) {
    case 'searching':
      return messages.ingest.batch.matchingRemote
    case 'updating':
      return messages.ingest.batch.updatingLocal
  }
}
