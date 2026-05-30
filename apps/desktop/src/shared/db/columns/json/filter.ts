import { customType } from 'drizzle-orm/sqlite-core'

import type { FilterState } from '../../contracts/json'
import { matchesPlainObject } from './utils'

function normalizeFilterValueForStorage(value: unknown): FilterState[string] | undefined {
  if (value === undefined || value === null) return undefined

  if (value === true) return true
  if (value === false) return undefined

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    const strings = value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
    return strings.length > 0 ? strings : undefined
  }

  if (!matchesPlainObject(value)) return undefined

  if ('match' in value && 'ids' in value) {
    const match = value.match
    const ids = value.ids
    if (match !== 'any' && match !== 'all') return undefined
    if (!Array.isArray(ids)) return undefined
    const normalizedIds = ids
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
    return normalizedIds.length > 0
      ? ({ match, ids: normalizedIds } as FilterState[string])
      : undefined
  }

  if ('min' in value || 'max' in value) {
    const min = value.min
    const max = value.max
    const normalizedMin = typeof min === 'number' ? min : undefined
    const normalizedMax = typeof max === 'number' ? max : undefined
    return normalizedMin === undefined && normalizedMax === undefined
      ? undefined
      : ({ min: normalizedMin, max: normalizedMax } as FilterState[string])
  }

  if ('from' in value || 'to' in value) {
    const from = typeof value.from === 'string' && value.from.trim() ? value.from.trim() : undefined
    const to = typeof value.to === 'string' && value.to.trim() ? value.to.trim() : undefined
    return from || to ? ({ from, to } as FilterState[string]) : undefined
  }

  return undefined
}

export const filterState = customType<{
  data: FilterState
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): FilterState {
    if (!value || value === '{}' || value === 'null') return {}
    try {
      const parsed = JSON.parse(value)
      if (!matchesPlainObject(parsed)) {
        return {}
      }

      const record = parsed as Record<string, unknown>
      const normalized: Record<string, FilterState[string]> = {}
      for (const [key, rawValue] of Object.entries(record)) {
        const normalizedValue = normalizeFilterValueForStorage(rawValue)
        if (normalizedValue !== undefined) {
          normalized[key] = normalizedValue
        }
      }
      return normalized
    } catch {
      return {}
    }
  },

  toDriver(value: FilterState): string {
    if (!matchesPlainObject(value)) {
      throw new Error('filterState must be an object')
    }
    for (const [key, rawValue] of Object.entries(value)) {
      const normalizedValue = normalizeFilterValueForStorage(rawValue)
      if (normalizedValue === undefined) {
        throw new Error(`Invalid filterState value for key: ${key}`)
      }
    }
    return JSON.stringify(value)
  }
})
