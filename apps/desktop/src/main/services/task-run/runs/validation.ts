import type { TaskRunProgressUnit, TaskRunRatePeriod, TaskRunWarning } from '@shared/task-run'

const MAX_COUNTERS = 20
const MAX_WARNINGS = 20
const MAX_COUNTER_KEY_LENGTH = 80
const MAX_WARNING_CODE_LENGTH = 80
const MAX_WARNING_MESSAGE_LENGTH = 500

export function sanitizeCounters(counters: unknown): Record<string, number> | undefined {
  if (counters === undefined) {
    return undefined
  }

  if (!isPlainObject(counters)) {
    throw new Error('Task run counters must be an object.')
  }

  const entries = Object.entries(counters).slice(0, MAX_COUNTERS)
  const sanitized: Record<string, number> = {}
  for (const [key, value] of entries) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Task run counters must contain finite numbers.')
    }
    sanitized[key.slice(0, MAX_COUNTER_KEY_LENGTH)] = value
  }

  return sanitized
}

export function sanitizeWarnings(warnings: unknown): readonly TaskRunWarning[] | undefined {
  if (warnings === undefined) {
    return undefined
  }

  if (!Array.isArray(warnings)) {
    throw new Error('Task run warnings must be an array.')
  }

  return warnings.slice(0, MAX_WARNINGS).map((warning) => {
    if (!isPlainObject(warning) || typeof warning.message !== 'string') {
      throw new Error('Task run warning must contain a message string.')
    }
    const code = truncateOptionalString(warning.code, MAX_WARNING_CODE_LENGTH)
    const message = warning.message.slice(0, MAX_WARNING_MESSAGE_LENGTH)
    return code === undefined ? { message } : { code, message }
  })
}

export function assertOptionalNonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`)
  }

  return value
}

export function assertOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }

  return value
}

export function assertProgressUnit(value: unknown): TaskRunProgressUnit {
  switch (value) {
    case 'item':
    case 'file':
    case 'byte':
    case 'entity':
    case 'step':
    case 'package':
    case 'request':
      return value
    default:
      throw new Error('Task run work unit is invalid.')
  }
}

export function assertRatePeriod(value: unknown): TaskRunRatePeriod {
  if (value === 'second' || value === 'minute' || value === 'hour') {
    return value
  }

  throw new Error('Task run rate period must be "second", "minute", or "hour".')
}

export function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  label: string
): void {
  const unknownKey = Object.keys(value).find((key) => !knownKeys.has(key))
  if (unknownKey) {
    throw new Error(`${label} contains unknown field "${unknownKey}".`)
  }
}

export function truncateOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error('Task run text fields must be strings.')
  }

  return value.slice(0, maxLength)
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
