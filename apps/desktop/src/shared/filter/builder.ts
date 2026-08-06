/**
 * Filter query builder.
 *
 * Builds Drizzle SQL fragments from FilterState + FilterQuerySpec. All values
 * are bound as parameters; identifiers come from Drizzle table/column objects.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL
} from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'

import type { SortDirection } from '@shared/common'
import type { DateRangeValue, FilterCondition, FilterState } from './model'
import type { FilterQueryFieldDef, FilterQuerySpec, FilterRelationLink } from './spec'

function parseYyyyMmDd(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(day) || day < 1 || day > 31) return null

  return { year, month, day }
}

function localDayStartMs(date: string): number | null {
  const ymd = parseYyyyMmDd(date)
  if (!ymd) return null
  return new Date(ymd.year, ymd.month - 1, ymd.day, 0, 0, 0, 0).getTime()
}

function localDayEndMs(date: string): number | null {
  const ymd = parseYyyyMmDd(date)
  if (!ymd) return null
  return new Date(ymd.year, ymd.month - 1, ymd.day, 23, 59, 59, 999).getTime()
}

/** Sortable/comparable YYYYMMDD key derived from a PartialDate JSON column. */
function partialDateYmdKey(column: SQLiteColumn): SQL {
  return sql`((coalesce(cast(json_extract(${column}, '$.year') as integer), 0) * 10000) + (coalesce(cast(json_extract(${column}, '$.month') as integer), 1) * 100) + coalesce(cast(json_extract(${column}, '$.day') as integer), 1))`
}

/** True when the PartialDate column has a concrete year (also false for NULL). */
function partialDateHasYear(column: SQLiteColumn): SQL {
  return sql`json_type(${column}, '$.year') = 'integer'`
}

function partialDateRangeCondition(column: SQLiteColumn, value: DateRangeValue): SQL | null {
  const parts: SQL[] = [partialDateHasYear(column)]

  if (value.from) {
    const from = parseYyyyMmDd(value.from)
    if (!from) return null
    parts.push(
      sql`${partialDateYmdKey(column)} >= ${from.year * 10000 + from.month * 100 + from.day}`
    )
  }

  if (value.to) {
    const to = parseYyyyMmDd(value.to)
    if (!to) return null
    parts.push(sql`${partialDateYmdKey(column)} <= ${to.year * 10000 + to.month * 100 + to.day}`)
  }

  if (parts.length === 1) return null
  return and(...parts) ?? null
}

function timestampRangeCondition(column: SQLiteColumn, value: DateRangeValue): SQL | null {
  const parts: SQL[] = []
  if (value.from) {
    const fromMs = localDayStartMs(value.from)
    if (fromMs !== null) parts.push(gte(column, fromMs))
  }
  if (value.to) {
    const toMs = localDayEndMs(value.to)
    if (toMs !== null) parts.push(lte(column, toMs))
  }
  return parts.length ? (and(...parts) ?? null) : null
}

function relationMembership(spec: FilterQuerySpec, link: FilterRelationLink, ids: string[]): SQL {
  return sql`select 1 from ${link.table} where ${eq(link.entityIdColumn, spec.idColumn)} and ${inArray(link.relatedIdColumn, ids)}`
}

function buildConditionSql(
  spec: FilterQuerySpec,
  field: FilterQueryFieldDef,
  condition: FilterCondition
): SQL | null {
  switch (condition.op) {
    case 'is':
      return field.kind === 'boolean' ? eq(field.column, condition.value) : null

    case 'anyOf':
      if (field.kind !== 'enum' || condition.value.length === 0) return null
      return inArray(field.column, condition.value)

    case 'noneOf':
      if (field.kind !== 'enum' || condition.value.length === 0) return null
      return or(isNull(field.column), notInArray(field.column, condition.value)) ?? null

    case 'inRange': {
      if (field.kind !== 'number') return null
      const parts: SQL[] = []
      if (typeof condition.value.min === 'number')
        parts.push(gte(field.column, condition.value.min))
      if (typeof condition.value.max === 'number')
        parts.push(lte(field.column, condition.value.max))
      return parts.length ? (and(...parts) ?? null) : null
    }

    case 'inDateRange':
      if (field.kind !== 'date') return null
      return field.mode === 'partialDate'
        ? partialDateRangeCondition(field.column, condition.value)
        : timestampRangeCondition(field.column, condition.value)

    case 'isEmpty':
      if (field.kind === 'number') return isNull(field.column)
      if (field.kind !== 'date') return null
      return field.mode === 'partialDate'
        ? sql`not (${partialDateHasYear(field.column)})`
        : isNull(field.column)

    case 'isSet':
      if (field.kind === 'number') return isNotNull(field.column)
      if (field.kind !== 'date') return null
      return field.mode === 'partialDate'
        ? partialDateHasYear(field.column)
        : isNotNull(field.column)

    case 'hasAnyOf':
      if (field.kind !== 'relation' || condition.value.length === 0) return null
      return sql`exists (${relationMembership(spec, field.link, condition.value)})`

    case 'hasNoneOf':
      if (field.kind !== 'relation' || condition.value.length === 0) return null
      return sql`not exists (${relationMembership(spec, field.link, condition.value)})`

    case 'hasAllOf': {
      if (field.kind !== 'relation' || condition.value.length === 0) return null
      const { link } = field
      return sql`(select count(distinct ${link.relatedIdColumn}) from ${link.table} where ${eq(link.entityIdColumn, spec.idColumn)} and ${inArray(link.relatedIdColumn, condition.value)}) = ${condition.value.length}`
    }
  }
}

export function buildFilterConditions(spec: FilterQuerySpec, filter: FilterState): SQL | undefined {
  const parts: SQL[] = []

  for (const condition of filter.conditions) {
    const field = spec.fieldByKey.get(condition.field)
    if (!field) continue

    const part = buildConditionSql(spec, field, condition)
    if (part) parts.push(part)
  }

  if (parts.length === 0) return undefined
  return (filter.match === 'any' ? or(...parts) : and(...parts)) ?? undefined
}

function partialDateSortOrder(column: SQLiteColumn, direction: SortDirection): SQL {
  // Rows with less precise dates sort after fully specified ones within the
  // same direction; the extra keys keep year-only and month/day-only values
  // grouped deterministically.
  const precisionRank = sql`case
    when json_type(${column}, '$.year') = 'integer' then 0
    when json_type(${column}, '$.month') = 'integer' and json_type(${column}, '$.day') = 'integer' then 1
    when json_type(${column}, '$.month') = 'integer' then 2
    when json_type(${column}, '$.day') = 'integer' then 3
    else 4
  end`
  const mdKey = sql`((coalesce(cast(json_extract(${column}, '$.month') as integer), 0) * 100) + coalesce(cast(json_extract(${column}, '$.day') as integer), 0))`
  const dayKey = sql`coalesce(cast(json_extract(${column}, '$.day') as integer), 0)`
  const dir = sql.raw(direction === 'desc' ? 'desc' : 'asc')

  return sql`${precisionRank} asc, ${partialDateYmdKey(column)} ${dir}, ${mdKey} ${dir}, ${dayKey} ${dir}`
}

export function buildOrderBy(spec: FilterQuerySpec, key: string, direction: SortDirection) {
  const def = spec.sortByKey.get(key) ?? spec.sortByKey.get(spec.sort.defaultKey)
  if (!def) {
    throw new Error(`Sort key not found: ${key}`)
  }

  if (def.kind === 'partialDate') {
    return partialDateSortOrder(def.column, direction)
  }

  return direction === 'desc' ? desc(def.column) : asc(def.column)
}
