import { customType } from 'drizzle-orm/sqlite-core'

import type {
  BackgroundTaskFailurePolicy,
  BackgroundTaskRunRecord,
  BackgroundTaskTriggers
} from '../../../background-task'
import { matchesPlainObject, parseJsonValue } from './utils'

function matchesBackgroundTaskTriggers(value: unknown): value is BackgroundTaskTriggers {
  if (!matchesPlainObject(value) || typeof value.onStartup !== 'boolean') return false

  if (value.cron === undefined) {
    return true
  }

  if (!matchesPlainObject(value.cron) || typeof value.cron.expression !== 'string') {
    return false
  }

  if (value.cron.expression.trim().length === 0) {
    return false
  }

  return value.cron.timezone === undefined || typeof value.cron.timezone === 'string'
}

function matchesBackgroundTaskFailurePolicy(value: unknown): value is BackgroundTaskFailurePolicy {
  if (!matchesPlainObject(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'none':
      return true
    case 'retry':
      return typeof value.retryCount === 'number'
    case 'pauseTask':
      return value.retryCount === undefined || typeof value.retryCount === 'number'
    default:
      return false
  }
}

const BACKGROUND_TASK_RUN_STATUSES = new Set(['success', 'failed', 'cancelled', 'skipped'])
const BACKGROUND_TASK_RUN_TRIGGERS = new Set(['manual', 'startup', 'cron'])

function matchesBackgroundTaskRunRecord(value: unknown): value is BackgroundTaskRunRecord {
  if (!matchesPlainObject(value)) return false

  const error = value.error
  return (
    typeof value.id === 'string' &&
    typeof value.taskId === 'string' &&
    typeof value.commandId === 'string' &&
    typeof value.startedAt === 'number' &&
    typeof value.finishedAt === 'number' &&
    typeof value.attempt === 'number' &&
    typeof value.status === 'string' &&
    BACKGROUND_TASK_RUN_STATUSES.has(value.status) &&
    typeof value.trigger === 'string' &&
    BACKGROUND_TASK_RUN_TRIGGERS.has(value.trigger) &&
    (error === undefined || typeof error === 'string')
  )
}

export const backgroundTaskArgs = customType<{
  data: Record<string, unknown>
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): Record<string, unknown> {
    try {
      const parsed = parseJsonValue(value)
      return matchesPlainObject(parsed) ? parsed : {}
    } catch {
      return {}
    }
  },

  toDriver(value: Record<string, unknown>): string {
    if (!matchesPlainObject(value)) {
      throw new Error('backgroundTaskArgs must be an object')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskTriggers = customType<{
  data: BackgroundTaskTriggers
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskTriggers {
    try {
      const parsed = parseJsonValue(value)
      return matchesBackgroundTaskTriggers(parsed) ? parsed : { onStartup: false }
    } catch {
      return { onStartup: false }
    }
  },

  toDriver(value: BackgroundTaskTriggers): string {
    if (!matchesBackgroundTaskTriggers(value)) {
      throw new Error('backgroundTaskTriggers must be valid triggers')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskFailurePolicy = customType<{
  data: BackgroundTaskFailurePolicy
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskFailurePolicy {
    try {
      const parsed = parseJsonValue(value)
      return matchesBackgroundTaskFailurePolicy(parsed) ? parsed : { type: 'none' }
    } catch {
      return { type: 'none' }
    }
  },

  toDriver(value: BackgroundTaskFailurePolicy): string {
    if (!matchesBackgroundTaskFailurePolicy(value)) {
      throw new Error('backgroundTaskFailurePolicy must be a valid failure policy')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskHistory = customType<{
  data: BackgroundTaskRunRecord[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskRunRecord[] {
    try {
      const parsed = parseJsonValue(value)
      return Array.isArray(parsed) ? parsed.filter(matchesBackgroundTaskRunRecord) : []
    } catch {
      return []
    }
  },

  toDriver(value: BackgroundTaskRunRecord[]): string {
    if (!Array.isArray(value) || !value.every(matchesBackgroundTaskRunRecord)) {
      throw new Error('backgroundTaskHistory must be an array of run records')
    }
    return JSON.stringify(value)
  }
})
