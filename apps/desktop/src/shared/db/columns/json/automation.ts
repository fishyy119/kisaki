import { customType } from 'drizzle-orm/sqlite-core'

import type {
  AutomationFailurePolicy,
  AutomationInvocationError,
  AutomationOwner,
  AutomationTriggers
} from '../../../automation'
import { matchesPlainObject, parseJsonValue } from './utils'

function matchesAutomationTriggers(value: unknown): value is AutomationTriggers {
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

function matchesAutomationFailurePolicy(value: unknown): value is AutomationFailurePolicy {
  if (!matchesPlainObject(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'none':
      return true
    case 'retry':
      return typeof value.retryCount === 'number'
    case 'pauseAutomation':
      return value.retryCount === undefined || typeof value.retryCount === 'number'
    default:
      return false
  }
}

function matchesAutomationOwner(value: unknown): value is AutomationOwner {
  if (!matchesPlainObject(value) || typeof value.type !== 'string') return false

  if (value.type === 'app') {
    return true
  }

  if (value.type !== 'extension' || !matchesPlainObject(value.extension)) {
    return false
  }

  return (
    typeof value.extension.id === 'string' &&
    value.extension.id.trim().length > 0 &&
    (value.extension.nameSnapshot === undefined || typeof value.extension.nameSnapshot === 'string')
  )
}

function matchesAutomationInvocationError(value: unknown): value is AutomationInvocationError {
  if (!matchesPlainObject(value) || typeof value.message !== 'string') return false

  return value.code === undefined || typeof value.code === 'string'
}

export const automationArgs = customType<{
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
      throw new Error('automationArgs must be an object')
    }
    return JSON.stringify(value)
  }
})

export const automationOwner = customType<{
  data: AutomationOwner
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): AutomationOwner {
    try {
      const parsed = parseJsonValue(value)
      return matchesAutomationOwner(parsed) ? parsed : { type: 'app' }
    } catch {
      return { type: 'app' }
    }
  },

  toDriver(value: AutomationOwner): string {
    if (!matchesAutomationOwner(value)) {
      throw new Error('automationOwner must be a valid owner')
    }
    return JSON.stringify(value)
  }
})

export const automationTriggers = customType<{
  data: AutomationTriggers
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): AutomationTriggers {
    try {
      const parsed = parseJsonValue(value)
      return matchesAutomationTriggers(parsed) ? parsed : { onStartup: false }
    } catch {
      return { onStartup: false }
    }
  },

  toDriver(value: AutomationTriggers): string {
    if (!matchesAutomationTriggers(value)) {
      throw new Error('automationTriggers must be valid triggers')
    }
    return JSON.stringify(value)
  }
})

export const automationFailurePolicy = customType<{
  data: AutomationFailurePolicy
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): AutomationFailurePolicy {
    try {
      const parsed = parseJsonValue(value)
      return matchesAutomationFailurePolicy(parsed) ? parsed : { type: 'none' }
    } catch {
      return { type: 'none' }
    }
  },

  toDriver(value: AutomationFailurePolicy): string {
    if (!matchesAutomationFailurePolicy(value)) {
      throw new Error('automationFailurePolicy must be a valid failure policy')
    }
    return JSON.stringify(value)
  }
})

export const automationInvocationError = customType<{
  data: AutomationInvocationError | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): AutomationInvocationError | null {
    if (value === null) {
      return null
    }

    try {
      const parsed = parseJsonValue(value)
      return matchesAutomationInvocationError(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  toDriver(value: AutomationInvocationError | null): string | null {
    if (value === null) {
      return null
    }

    if (!matchesAutomationInvocationError(value)) {
      throw new Error('automationInvocationError must be a valid invocation error')
    }
    return JSON.stringify(value)
  }
})
