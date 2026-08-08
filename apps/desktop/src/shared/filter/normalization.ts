/**
 * FilterState boundary normalization.
 *
 * Single implementation of "lenient read" for every boundary that re-enters
 * persisted or foreign filter data (db columns, extension inputs). Parsing is
 * total: malformed input degrades to an empty filter, malformed or no-op
 * conditions are dropped.
 */
import type { DateRangeValue, FilterCondition, FilterState, NumberRangeValue } from './model'
import { createEmptyFilter } from './state'

const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function matchesPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return ids.length > 0 ? [...new Set(ids)] : undefined
}

function parseNumberRange(value: unknown): NumberRangeValue | undefined {
  if (!matchesPlainObject(value)) return undefined
  const min = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : undefined
  const max = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : undefined
  if (min === undefined && max === undefined) return undefined
  return { ...(min !== undefined && { min }), ...(max !== undefined && { max }) }
}

function parseDateBound(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return YYYY_MM_DD_PATTERN.test(trimmed) ? trimmed : undefined
}

function parseDateRange(value: unknown): DateRangeValue | undefined {
  if (!matchesPlainObject(value)) return undefined
  const from = parseDateBound(value.from)
  const to = parseDateBound(value.to)
  if (from === undefined && to === undefined) return undefined
  return { ...(from !== undefined && { from }), ...(to !== undefined && { to }) }
}

/** Parses one condition; returns undefined for malformed or no-op input. */
export function parseFilterCondition(value: unknown): FilterCondition | undefined {
  if (!matchesPlainObject(value)) return undefined
  const field = typeof value.field === 'string' ? value.field.trim() : ''
  if (!field) return undefined

  switch (value.op) {
    case 'is':
      return typeof value.value === 'boolean' ? { field, op: 'is', value: value.value } : undefined
    case 'anyOf':
    case 'noneOf':
    case 'hasAnyOf':
    case 'hasAllOf':
    case 'hasNoneOf': {
      const ids = parseIdList(value.value)
      return ids ? { field, op: value.op, value: ids } : undefined
    }
    case 'inRange': {
      const range = parseNumberRange(value.value)
      return range ? { field, op: 'inRange', value: range } : undefined
    }
    case 'inDateRange': {
      const range = parseDateRange(value.value)
      return range ? { field, op: 'inDateRange', value: range } : undefined
    }
    case 'isEmpty':
    case 'isSet':
      return { field, op: value.op }
    default:
      return undefined
  }
}

/**
 * Parses unknown input into a valid FilterState.
 *
 * Unrecognized shapes (including retired formats) fall back to the empty
 * filter; individual malformed conditions are dropped.
 */
export function parseFilterState(value: unknown): FilterState {
  if (!matchesPlainObject(value)) return createEmptyFilter()

  const match = value.match === 'any' ? 'any' : value.match === 'all' ? 'all' : undefined
  if (match === undefined || !Array.isArray(value.conditions)) return createEmptyFilter()

  const conditions: FilterCondition[] = []
  for (const entry of value.conditions) {
    const condition = parseFilterCondition(entry)
    if (condition) conditions.push(condition)
  }
  return { match, conditions }
}
