/**
 * Immutable FilterState operations.
 *
 * All operations return a new state; inputs are never mutated.
 */
import type { FilterCondition, FilterFieldKind, FilterMatchMode, FilterState } from './model'

export function createEmptyFilter(): FilterState {
  return { match: 'all', conditions: [] }
}

/** Default condition when a field of the given kind is added or re-targeted. */
export function createDefaultCondition(field: string, kind: FilterFieldKind): FilterCondition {
  switch (kind) {
    case 'boolean':
      return { field, op: 'is', value: true }
    case 'enum':
      return { field, op: 'anyOf', value: [] }
    case 'number':
      return { field, op: 'inRange', value: {} }
    case 'date':
      return { field, op: 'inDateRange', value: {} }
    case 'relation':
      return { field, op: 'hasAnyOf', value: [] }
  }
}

export function hasConditions(filter: FilterState): boolean {
  return filter.conditions.length > 0
}

export function countConditions(filter: FilterState): number {
  return filter.conditions.length
}

export function setMatchMode(filter: FilterState, match: FilterMatchMode): FilterState {
  if (filter.match === match) return filter
  return { ...filter, match }
}

export function addCondition(filter: FilterState, condition: FilterCondition): FilterState {
  return { ...filter, conditions: [...filter.conditions, condition] }
}

export function updateCondition(
  filter: FilterState,
  index: number,
  condition: FilterCondition
): FilterState {
  if (index < 0 || index >= filter.conditions.length) return filter
  const conditions = filter.conditions.slice()
  conditions[index] = condition
  return { ...filter, conditions }
}

export function removeCondition(filter: FilterState, index: number): FilterState {
  if (index < 0 || index >= filter.conditions.length) return filter
  const conditions = filter.conditions.filter((_, i) => i !== index)
  return { ...filter, conditions }
}
