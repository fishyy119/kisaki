import type {
  TaskRunProgressPhase,
  TaskRunProgressUpdate,
  TaskRunProgressWork,
  TaskRunProgressWorkMetrics
} from '@shared/task-run'
import {
  assertKnownKeys,
  assertOptionalNonNegativeNumber,
  assertOptionalPositiveInteger,
  assertProgressUnit,
  assertRatePeriod,
  isPlainObject,
  sanitizeCounters,
  sanitizeWarnings
} from './validation'

const MAX_PHASE_KEY_LENGTH = 120
const MAX_PHASE_LABEL_LENGTH = 500

const PROGRESS_UPDATE_KEYS = new Set(['phase', 'work', 'counters', 'warnings'])
const PROGRESS_PHASE_KEYS = new Set(['key', 'label', 'current', 'total'])
const PROGRESS_WORK_KEYS = new Set(['current', 'total', 'unit', 'ratePeriod', 'indeterminate'])

export function sanitizeProgressUpdate(update: TaskRunProgressUpdate): TaskRunProgressUpdate {
  if (!isPlainObject(update)) {
    throw new Error('Task run progress update must be an object.')
  }
  assertKnownKeys(update, PROGRESS_UPDATE_KEYS, 'Task run progress update')

  const sanitized: TaskRunProgressUpdate = {}
  const phase = sanitizeProgressPhase(update.phase)
  const work = sanitizeProgressWork(update.work)
  const counters = sanitizeCounters(update.counters)
  const warnings = sanitizeWarnings(update.warnings)

  if (phase !== undefined) {
    sanitized.phase = phase
  }
  if (work !== undefined) {
    sanitized.work = work
  }
  if (counters !== undefined) {
    sanitized.counters = counters
  }
  if (warnings !== undefined) {
    sanitized.warnings = warnings
  }

  return sanitized
}

export function mergeWorkMetrics(
  work: TaskRunProgressWork | undefined,
  metrics: TaskRunProgressWorkMetrics
): (TaskRunProgressWork & TaskRunProgressWorkMetrics) | undefined {
  const hasMetrics =
    metrics.rate !== undefined || metrics.etaMs !== undefined || metrics.percent !== undefined
  if (!work && !hasMetrics) {
    return undefined
  }

  return {
    ...work,
    ...metrics
  }
}

function sanitizeProgressPhase(phase: unknown): TaskRunProgressPhase | undefined {
  if (phase === undefined) {
    return undefined
  }

  if (!isPlainObject(phase)) {
    throw new Error('Task run progress phase must be an object.')
  }
  assertKnownKeys(phase, PROGRESS_PHASE_KEYS, 'Task run progress phase')

  if (typeof phase.key !== 'string' || typeof phase.label !== 'string') {
    throw new Error('Task run phase key and label must be non-empty strings.')
  }

  const key = phase.key.slice(0, MAX_PHASE_KEY_LENGTH)
  const label = phase.label.slice(0, MAX_PHASE_LABEL_LENGTH)
  const current = assertOptionalPositiveInteger(phase.current, 'Task run phase current')
  const total = assertOptionalPositiveInteger(phase.total, 'Task run phase total')

  if (!key || !label) {
    throw new Error('Task run phase key and label must be non-empty strings.')
  }

  if (current !== undefined && total !== undefined && current > total) {
    throw new Error('Task run phase current must not be greater than phase total.')
  }

  const sanitized: TaskRunProgressPhase = { key, label }
  if (current !== undefined) {
    sanitized.current = current
  }
  if (total !== undefined) {
    sanitized.total = total
  }
  return sanitized
}

function sanitizeProgressWork(work: unknown): TaskRunProgressWork | undefined {
  if (work === undefined) {
    return undefined
  }

  if (!isPlainObject(work)) {
    throw new Error('Task run progress work must be an object.')
  }
  assertKnownKeys(work, PROGRESS_WORK_KEYS, 'Task run progress work')

  const current = assertOptionalNonNegativeNumber(work.current, 'Task run work current')
  const total = assertOptionalNonNegativeNumber(work.total, 'Task run work total')
  const sanitized: TaskRunProgressWork = {}

  if (current !== undefined) {
    sanitized.current = current
  }
  if (total !== undefined) {
    sanitized.total = total
  }
  if (work.unit !== undefined) {
    sanitized.unit = assertProgressUnit(work.unit)
  }
  if (work.ratePeriod !== undefined) {
    sanitized.ratePeriod = assertRatePeriod(work.ratePeriod)
  }
  if (work.indeterminate !== undefined) {
    if (typeof work.indeterminate !== 'boolean') {
      throw new Error('Task run work indeterminate must be a boolean.')
    }
    sanitized.indeterminate = work.indeterminate
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}
