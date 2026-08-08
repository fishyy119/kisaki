import { customType } from 'drizzle-orm/sqlite-core'

import type { PartialDate } from '../contracts/json'

const PARTIAL_DATE_KEYS = new Set(['year', 'month', 'day'])

function matchesInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function matchesRange(value: unknown, min: number, max: number): boolean {
  return matchesInteger(value) && value >= min && value <= max
}

/**
 * Contract check for a partial date: at least one component, no foreign keys,
 * integers within calendar ranges, and no day without a month.
 */
export function matchesPartialDate(value: unknown): value is PartialDate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length === 0) {
    return false
  }

  if (keys.some((key) => !PARTIAL_DATE_KEYS.has(key))) {
    return false
  }

  const hasYear = 'year' in record
  const hasMonth = 'month' in record
  const hasDay = 'day' in record

  if (hasYear && hasDay && !hasMonth) {
    return false
  }

  if (hasYear && !matchesInteger(record.year)) {
    return false
  }

  // Calendar ranges only; day-in-month validity is not enforced because partial
  // dates routinely carry a day without a month-defining year.
  if (hasMonth && !matchesRange(record.month, 1, 12)) {
    return false
  }

  if (hasDay && !matchesRange(record.day, 1, 31)) {
    return false
  }

  return true
}

/** Canonical form of a partial date, or null when the value is not one. */
export function normalizePartialDate(value: unknown): PartialDate | null {
  if (!matchesPartialDate(value)) {
    return null
  }

  const normalized: PartialDate = {}
  if (value.year !== undefined) {
    normalized.year = value.year
  }
  if (value.month !== undefined) {
    normalized.month = value.month
  }
  if (value.day !== undefined) {
    normalized.day = value.day
  }
  return normalized
}

export const partialDate = customType<{
  data: PartialDate | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): PartialDate | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      const normalized = normalizePartialDate(parsed)
      return normalized
    } catch {
      return null
    }
  },

  toDriver(value: PartialDate | null): string | null {
    if (!value) return null
    const normalized = normalizePartialDate(value)
    if (!normalized) {
      throw new Error('partialDate must be a valid PartialDate object or null')
    }
    return JSON.stringify(normalized)
  }
})
