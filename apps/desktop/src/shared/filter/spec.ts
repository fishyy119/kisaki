/**
 * Filter query spec.
 *
 * Declares how FilterState conditions and sort keys map onto an entity's
 * Drizzle table. Specs are the single source of truth for field kinds,
 * relation link tables, and filter-relevant table names.
 */
import { getTableColumns, getTableName } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'

/** How a date field is stored: epoch-ms integer or PartialDate JSON. */
export type DateColumnMode = 'timestampMs' | 'partialDate'

/** Link-table reference for a relation field, from the filtered entity's side. */
export interface FilterRelationLink {
  table: SQLiteTable
  /** FK column pointing at the filtered entity. */
  entityIdColumn: SQLiteColumn
  /** FK column pointing at the target entity. */
  relatedIdColumn: SQLiteColumn
}

export type FilterQueryFieldDef =
  | { key: string; kind: 'boolean'; column: SQLiteColumn }
  | { key: string; kind: 'enum'; column: SQLiteColumn }
  | { key: string; kind: 'number'; column: SQLiteColumn }
  | { key: string; kind: 'date'; mode: DateColumnMode; column: SQLiteColumn }
  | { key: string; kind: 'relation'; targetEntity: AllEntityType; link: FilterRelationLink }

export type FilterQuerySortDef =
  | { key: string; kind: 'column'; column: SQLiteColumn }
  | { key: string; kind: 'partialDate'; column: SQLiteColumn }

export interface FilterQuerySpecInput {
  entityType: AllEntityType
  table: SQLiteTable
  fields: readonly FilterQueryFieldDef[]
  sort: {
    defaultKey: string
    fields: readonly FilterQuerySortDef[]
  }
}

export interface FilterQuerySpec extends FilterQuerySpecInput {
  tableName: TableName
  /** Primary key column of the entity table; anchors correlated relation subqueries. */
  idColumn: SQLiteColumn
  fieldByKey: ReadonlyMap<string, FilterQueryFieldDef>
  sortByKey: ReadonlyMap<string, FilterQuerySortDef>
  /** Entity table plus every relation link table; drives db-change invalidation. */
  relevantTables: readonly TableName[]
}

/** Field keys declared by a spec, as a literal union. */
export type FilterFieldKeyOf<TSpec extends FilterQuerySpecInput> = TSpec['fields'][number]['key']

/** Sort keys declared by a spec, as a literal union. */
export type FilterSortKeyOf<TSpec extends FilterQuerySpecInput> =
  TSpec['sort']['fields'][number]['key']

/**
 * Keeps the literal field and sort keys of the declaration so dependent specs
 * (such as the renderer UI specs) can be checked against them at compile time.
 */
export function defineFilterQuerySpec<const TInput extends FilterQuerySpecInput>(
  input: TInput
): FilterQuerySpec & TInput {
  const idColumn = getTableColumns(input.table).id as SQLiteColumn | undefined
  if (!idColumn) {
    throw new Error(`Filter spec table for ${input.entityType} has no id column`)
  }

  const fieldByKey = new Map<string, FilterQueryFieldDef>()
  for (const field of input.fields) {
    if (fieldByKey.has(field.key)) {
      throw new Error(`Duplicate filter field key: ${field.key}`)
    }
    fieldByKey.set(field.key, field)
  }

  const sortByKey = new Map<string, FilterQuerySortDef>()
  for (const def of input.sort.fields) {
    if (sortByKey.has(def.key)) {
      throw new Error(`Duplicate sort key: ${def.key}`)
    }
    sortByKey.set(def.key, def)
  }

  if (!sortByKey.has(input.sort.defaultKey)) {
    throw new Error(`Default sort key not found: ${input.sort.defaultKey}`)
  }

  const relevantTables = new Set<TableName>([getTableName(input.table) as TableName])
  for (const field of input.fields) {
    if (field.kind === 'relation') {
      relevantTables.add(getTableName(field.link.table) as TableName)
    }
  }

  return {
    ...input,
    tableName: getTableName(input.table) as TableName,
    idColumn,
    fieldByKey,
    sortByKey,
    relevantTables: [...relevantTables]
  }
}
