/**
 * Filter data model.
 *
 * A filter is a single-level list of conditions combined by one `match` mode.
 * Each condition references a field key declared by the entity's
 * FilterQuerySpec; the spec owns the field's kind and SQL mapping.
 */

/** How conditions combine: `all` = AND, `any` = OR. */
export type FilterMatchMode = 'all' | 'any'

/** Field kind vocabulary shared by query specs and UI specs. */
export type FilterFieldKind = 'boolean' | 'enum' | 'number' | 'date' | 'relation'

/** Inclusive number range; omitted ends are open. */
export interface NumberRangeValue {
  min?: number
  max?: number
}

/** Inclusive date range in YYYY-MM-DD; omitted ends are open. */
export interface DateRangeValue {
  from?: string
  to?: string
}

export type FilterOp =
  | 'is'
  | 'anyOf'
  | 'noneOf'
  | 'inRange'
  | 'inDateRange'
  | 'hasAnyOf'
  | 'hasAllOf'
  | 'hasNoneOf'
  | 'isEmpty'
  | 'isSet'

export type FilterCondition =
  | { field: string; op: 'is'; value: boolean }
  | { field: string; op: 'anyOf' | 'noneOf'; value: string[] }
  | { field: string; op: 'inRange'; value: NumberRangeValue }
  | { field: string; op: 'inDateRange'; value: DateRangeValue }
  | { field: string; op: 'hasAnyOf' | 'hasAllOf' | 'hasNoneOf'; value: string[] }
  | { field: string; op: 'isEmpty' | 'isSet' }

export interface FilterState {
  match: FilterMatchMode
  conditions: FilterCondition[]
}

/** Relation membership ops (link-table conditions). */
export const RELATION_FILTER_OPS = ['hasAnyOf', 'hasAllOf', 'hasNoneOf'] as const

/** Legal ops per field kind; drives both SQL building and the op picker UI. */
export const FILTER_OPS_BY_KIND: Record<FilterFieldKind, readonly FilterOp[]> = {
  boolean: ['is'],
  enum: ['anyOf', 'noneOf'],
  number: ['inRange', 'isEmpty', 'isSet'],
  date: ['inDateRange', 'isEmpty', 'isSet'],
  relation: RELATION_FILTER_OPS
}

/** Trusted domain check: whether an op is legal for a field kind. */
export function isFilterOpForKind(kind: FilterFieldKind, op: FilterOp): boolean {
  return FILTER_OPS_BY_KIND[kind].includes(op)
}

/** Trusted domain check: whether a condition targets a relation link. */
export function isRelationCondition(
  condition: FilterCondition
): condition is Extract<FilterCondition, { op: 'hasAnyOf' | 'hasAllOf' | 'hasNoneOf' }> {
  return (RELATION_FILTER_OPS as readonly FilterOp[]).includes(condition.op)
}
