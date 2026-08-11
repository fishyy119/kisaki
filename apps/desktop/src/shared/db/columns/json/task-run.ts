import { customType } from 'drizzle-orm/sqlite-core'

import type {
  TaskRunCategory,
  TaskRunControls,
  TaskRunFinalStatus,
  TaskRunInitiator,
  TaskRunOperation,
  TaskRunOwner,
  TaskRunProgress,
  TaskRunProgressPhase,
  TaskRunRatePeriod,
  TaskRunProgressUnit,
  TaskRunProgressWork,
  TaskRunResult,
  TaskRunSubject,
  TaskRunSubjectType,
  TaskRunWarning
} from '../../../task-run'
import { createEnumType } from '../factories'
import { createNullableJsonType, createRequiredJsonType } from './factories'
import {
  matchesNonNegativeFiniteNumber,
  matchesNumberRecord,
  matchesOptionalString,
  matchesPlainObject
} from './utils'

const TASK_RUN_CATEGORY_VALUES = ['scanner', 'ingest', 'extension', 'updater', 'system'] as const
export const taskRunCategory = createEnumType<TaskRunCategory>(
  TASK_RUN_CATEGORY_VALUES,
  'system',
  'taskRunCategory'
)

const TASK_RUN_FINAL_STATUS_VALUES = ['completed', 'failed', 'cancelled'] as const
export const taskRunFinalStatus = createEnumType<TaskRunFinalStatus>(
  TASK_RUN_FINAL_STATUS_VALUES,
  'failed',
  'taskRunFinalStatus'
)

const TASK_RUN_CONTENT_ENTITY_VALUES = new Set(['game', 'anime', 'person', 'company', 'character'])
const TASK_RUN_INGEST_ACTION_VALUES = new Set([
  'add',
  'update',
  'batchAdd',
  'batchUpdate',
  'batchDelete'
])
const TASK_RUN_STATIC_OPERATIONS = new Set([
  'scanner.scan',
  'extension.package.install',
  'extension.package.update',
  'extension.package.import',
  'extension.package.uninstall',
  'extension.repository.refresh',
  'extension.repository.refreshAll',
  'updater.check',
  'updater.download',
  'system.maintenance'
])
const TASK_RUN_AUTOMATION_TRIGGER_VALUES = new Set(['manual', 'startup', 'cron'])
const TASK_RUN_SYSTEM_REASON_VALUES = new Set(['startup', 'maintenance', 'update', 'shutdown'])
const TASK_RUN_SUBJECT_TYPE_VALUES = new Set<TaskRunSubjectType>([
  'command',
  'automation',
  'scanner',
  'game',
  'anime',
  'person',
  'company',
  'character',
  'extension',
  'repository',
  'app'
])
const TASK_RUN_PROGRESS_UNIT_VALUES = new Set<TaskRunProgressUnit>([
  'item',
  'file',
  'byte',
  'entity',
  'step',
  'package',
  'request'
])
const TASK_RUN_RATE_PERIOD_VALUES = new Set<TaskRunRatePeriod>(['second', 'minute', 'hour'])

function matchesPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function matchesTaskRunFinalStatus(value: unknown): value is TaskRunFinalStatus {
  return (
    typeof value === 'string' && TASK_RUN_FINAL_STATUS_VALUES.includes(value as TaskRunFinalStatus)
  )
}

function matchesTaskRunOperation(value: unknown): value is TaskRunOperation {
  if (typeof value !== 'string') {
    return false
  }

  if (TASK_RUN_STATIC_OPERATIONS.has(value)) {
    return true
  }

  const ingestMatch = /^ingest\.([^.]+)\.([^.]+)$/.exec(value)
  if (ingestMatch) {
    return (
      TASK_RUN_CONTENT_ENTITY_VALUES.has(ingestMatch[1]) &&
      TASK_RUN_INGEST_ACTION_VALUES.has(ingestMatch[2])
    )
  }

  if (!value.startsWith('extension.task.')) {
    return false
  }

  const suffix = value.slice('extension.task.'.length)
  const segments = suffix.split('.')
  return segments.length >= 2 && segments.every((segment) => segment.length > 0)
}

function matchesTaskRunExtensionSnapshot(value: unknown): value is {
  id: string
  nameSnapshot?: string
} {
  return (
    matchesPlainObject(value) &&
    typeof value.id === 'string' &&
    matchesOptionalString(value.nameSnapshot)
  )
}

function matchesTaskRunOwner(value: unknown): value is TaskRunOwner {
  if (!matchesPlainObject(value) || typeof value.type !== 'string') {
    return false
  }

  if (value.type === 'app') {
    return true
  }

  return value.type === 'extension' && matchesTaskRunExtensionSnapshot(value.extension)
}

function matchesTaskRunInitiator(value: unknown): value is TaskRunInitiator {
  if (!matchesPlainObject(value) || typeof value.type !== 'string') {
    return false
  }

  switch (value.type) {
    case 'user':
      return true
    case 'automation': {
      const automation = value.automation
      return (
        matchesPlainObject(automation) &&
        typeof automation.id === 'string' &&
        typeof automation.nameSnapshot === 'string' &&
        typeof automation.trigger === 'string' &&
        TASK_RUN_AUTOMATION_TRIGGER_VALUES.has(automation.trigger) &&
        matchesPositiveInteger(automation.attempt)
      )
    }
    case 'extension':
      return matchesTaskRunExtensionSnapshot(value.extension)
    case 'system':
      return (
        value.reason === undefined ||
        (typeof value.reason === 'string' && TASK_RUN_SYSTEM_REASON_VALUES.has(value.reason))
      )
    default:
      return false
  }
}

function matchesTaskRunSubject(value: unknown): value is TaskRunSubject {
  return (
    matchesPlainObject(value) &&
    typeof value.type === 'string' &&
    TASK_RUN_SUBJECT_TYPE_VALUES.has(value.type as TaskRunSubjectType) &&
    matchesOptionalString(value.id) &&
    matchesOptionalString(value.labelSnapshot)
  )
}

function matchesTaskRunControls(value: unknown): value is TaskRunControls {
  return (
    matchesPlainObject(value) &&
    typeof value.cancelable === 'boolean' &&
    typeof value.pausable === 'boolean'
  )
}

function matchesTaskRunWarning(value: unknown): value is TaskRunWarning {
  return (
    matchesPlainObject(value) &&
    matchesOptionalString(value.code) &&
    typeof value.message === 'string'
  )
}

function matchesTaskRunWarnings(value: unknown): value is readonly TaskRunWarning[] {
  return Array.isArray(value) && value.every(matchesTaskRunWarning)
}

function matchesTaskRunProgressPhase(value: unknown): value is TaskRunProgressPhase {
  if (!matchesPlainObject(value)) {
    return false
  }

  return (
    typeof value.key === 'string' &&
    value.key.length > 0 &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    (value.current === undefined || matchesPositiveInteger(value.current)) &&
    (value.total === undefined || matchesPositiveInteger(value.total)) &&
    (value.current === undefined ||
      value.total === undefined ||
      (typeof value.current === 'number' &&
        typeof value.total === 'number' &&
        value.current <= value.total))
  )
}

function matchesTaskRunProgressWork(value: unknown): value is TaskRunProgressWork {
  if (!matchesPlainObject(value)) {
    return false
  }

  return (
    (value.current === undefined || matchesNonNegativeFiniteNumber(value.current)) &&
    (value.total === undefined || matchesNonNegativeFiniteNumber(value.total)) &&
    (value.unit === undefined ||
      (typeof value.unit === 'string' &&
        TASK_RUN_PROGRESS_UNIT_VALUES.has(value.unit as TaskRunProgressUnit))) &&
    (value.ratePeriod === undefined ||
      (typeof value.ratePeriod === 'string' &&
        TASK_RUN_RATE_PERIOD_VALUES.has(value.ratePeriod as TaskRunRatePeriod))) &&
    (value.indeterminate === undefined || typeof value.indeterminate === 'boolean') &&
    (value.rate === undefined || matchesNonNegativeFiniteNumber(value.rate)) &&
    (value.etaMs === undefined || matchesNonNegativeFiniteNumber(value.etaMs)) &&
    (value.percent === undefined || matchesNonNegativeFiniteNumber(value.percent))
  )
}

function matchesTaskRunProgress(value: unknown): value is TaskRunProgress {
  if (!matchesPlainObject(value) || !matchesNonNegativeFiniteNumber(value.updatedAt)) {
    return false
  }

  return (
    (value.phase === undefined || matchesTaskRunProgressPhase(value.phase)) &&
    (value.work === undefined || matchesTaskRunProgressWork(value.work)) &&
    (value.counters === undefined || matchesNumberRecord(value.counters)) &&
    (value.warnings === undefined || matchesTaskRunWarnings(value.warnings))
  )
}

function matchesTaskRunResult(value: unknown): value is TaskRunResult {
  return (
    matchesPlainObject(value) &&
    matchesTaskRunFinalStatus(value.status) &&
    matchesOptionalString(value.title) &&
    matchesOptionalString(value.summary) &&
    matchesOptionalString(value.error) &&
    (value.counters === undefined || matchesNumberRecord(value.counters)) &&
    (value.warnings === undefined || matchesTaskRunWarnings(value.warnings))
  )
}

export const taskRunOperation = customType<{
  data: TaskRunOperation
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): TaskRunOperation {
    return matchesTaskRunOperation(value) ? value : 'system.maintenance'
  },

  toDriver(value: TaskRunOperation): string {
    if (matchesTaskRunOperation(value)) {
      return value
    }

    throw new Error(`Invalid taskRunOperation value: ${value}`)
  }
})

export const taskRunOwner = createRequiredJsonType<TaskRunOwner>(
  'taskRunOwner',
  { type: 'app' },
  matchesTaskRunOwner
)

export const taskRunInitiator = createRequiredJsonType<TaskRunInitiator>(
  'taskRunInitiator',
  { type: 'system', reason: 'maintenance' },
  matchesTaskRunInitiator
)

export const taskRunSubject = createNullableJsonType<TaskRunSubject>(
  'taskRunSubject',
  matchesTaskRunSubject
)

export const taskRunControls = createRequiredJsonType<TaskRunControls>(
  'taskRunControls',
  { cancelable: false, pausable: false },
  matchesTaskRunControls
)

export const taskRunProgress = createNullableJsonType<TaskRunProgress>(
  'taskRunProgress',
  matchesTaskRunProgress
)

export const taskRunResult = createNullableJsonType<TaskRunResult>(
  'taskRunResult',
  matchesTaskRunResult
)
