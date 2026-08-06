/**
 * Filter System
 *
 * Shared filter contracts and query utilities.
 *
 * This module intentionally contains no UI metadata.
 */

export type {
  DateRangeValue,
  FilterCondition,
  FilterFieldKind,
  FilterMatchMode,
  FilterOp,
  FilterState,
  NumberRangeValue
} from './model'
export { FILTER_OPS_BY_KIND, isFilterOpForKind, isRelationCondition } from './model'

export {
  addCondition,
  countConditions,
  createDefaultCondition,
  createEmptyFilter,
  hasConditions,
  removeCondition,
  setMatchMode,
  updateCondition
} from './state'

export { matchesFilterStateShape, parseFilterCondition, parseFilterState } from './normalization'

export type {
  DateColumnMode,
  FilterQueryFieldDef,
  FilterQuerySortDef,
  FilterQuerySpec,
  FilterQuerySpecInput,
  FilterRelationLink
} from './spec'
export { defineFilterQuerySpec } from './spec'

export { buildFilterConditions, buildOrderBy } from './builder'

export { getFilterQuerySpec, getFilterRelevantTables } from './specs/registry'
export { gameFilterQuerySpec } from './specs/game'
export { characterFilterQuerySpec } from './specs/character'
export { personFilterQuerySpec } from './specs/person'
export { companyFilterQuerySpec } from './specs/company'
export { collectionFilterQuerySpec } from './specs/collection'
export { tagFilterQuerySpec } from './specs/tag'
