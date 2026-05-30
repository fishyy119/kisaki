import { customType } from 'drizzle-orm/sqlite-core'

import type { PartialDate } from '../contracts/json'

const PARTIAL_DATE_KEYS = new Set(['year', 'month', 'day'])

function matchesInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function matchesPartialDate(value: unknown): value is PartialDate {
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

  if (hasMonth && !matchesInteger(record.month)) {
    return false
  }

  if (hasDay && !matchesInteger(record.day)) {
    return false
  }

  return true
}

function normalizePartialDate(value: PartialDate | null | undefined): PartialDate | null {
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
