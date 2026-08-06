/**
 * Entity query executor.
 *
 * Single renderer-side implementation for filter/search/sort entity queries.
 * NSFW visibility, filter + search composition, and ordering are owned here;
 * the row-type cast below is the module's one controlled unsafe point.
 */
import { and, count, eq, inArray, type SQL } from 'drizzle-orm'

import type { AllEntityType, SortDirection } from '@shared/common'
import {
  buildFilterConditions,
  buildOrderBy,
  getFilterQuerySpec,
  type FilterState
} from '@shared/filter'
import { buildSearchCondition, getSearchQuerySpec } from '@shared/search'
import { ENTITY_TABLES, type EntityRowMap } from './entity-tables'
import { db } from './proxy'

export interface EntityQueryOptions {
  filter?: FilterState
  search?: string | null
  sortField?: string
  sortDirection?: SortDirection
  limit?: number
  includeNsfw: boolean
}

function buildWhere(entityType: AllEntityType, options: EntityQueryOptions): SQL | undefined {
  const parts: SQL[] = []

  if (options.filter) {
    const filterWhere = buildFilterConditions(getFilterQuerySpec(entityType), options.filter)
    if (filterWhere) parts.push(filterWhere)
  }
  if (options.search) {
    const searchWhere = buildSearchCondition(getSearchQuerySpec(entityType), options.search)
    if (searchWhere) parts.push(searchWhere)
  }
  if (!options.includeNsfw) {
    parts.push(eq(ENTITY_TABLES[entityType].isNsfwColumn, false))
  }

  if (parts.length === 0) return undefined
  return and(...parts)
}

function buildOrder(entityType: AllEntityType, options: EntityQueryOptions): SQL {
  const spec = getFilterQuerySpec(entityType)
  return buildOrderBy(
    spec,
    options.sortField ?? spec.sort.defaultKey,
    options.sortDirection ?? 'asc'
  )
}

export async function queryEntities<T extends AllEntityType>(
  entityType: T,
  options: EntityQueryOptions
): Promise<EntityRowMap[T][]> {
  const def = ENTITY_TABLES[entityType]

  let query = db.select().from(def.table).$dynamic().orderBy(buildOrder(entityType, options))

  const where = buildWhere(entityType, options)
  if (where) query = query.where(where)
  if (options.limit !== undefined) query = query.limit(options.limit)

  return (await query) as EntityRowMap[T][]
}

export async function countEntities(
  entityType: AllEntityType,
  options: Omit<EntityQueryOptions, 'sortField' | 'sortDirection' | 'limit'>
): Promise<number> {
  const def = ENTITY_TABLES[entityType]

  let query = db.select({ value: count() }).from(def.table).$dynamic()

  const where = buildWhere(entityType, options)
  if (where) query = query.where(where)

  const rows = await query
  return rows[0]?.value ?? 0
}

export async function queryEntityIds(
  entityType: AllEntityType,
  options: EntityQueryOptions
): Promise<string[]> {
  const def = ENTITY_TABLES[entityType]

  let query = db
    .select({ id: def.idColumn })
    .from(def.table)
    .$dynamic()
    .orderBy(buildOrder(entityType, options))

  const where = buildWhere(entityType, options)
  if (where) query = query.where(where)
  if (options.limit !== undefined) query = query.limit(options.limit)

  const rows = await query
  return rows.map((row) => row.id as string)
}

/** Resolves display names for the given ids, preserving input order. */
export async function queryEntityNames(
  entityType: AllEntityType,
  ids: readonly string[],
  includeNsfw: boolean
): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return []
  const def = ENTITY_TABLES[entityType]

  const parts: SQL[] = [inArray(def.idColumn, [...ids])]
  if (!includeNsfw) parts.push(eq(def.isNsfwColumn, false))

  const rows = await db
    .select({ id: def.idColumn, name: def.nameColumn })
    .from(def.table)
    .where(and(...parts))

  const nameById = new Map(rows.map((row) => [row.id as string, row.name as string]))
  return ids.filter((id) => nameById.has(id)).map((id) => ({ id, name: nameById.get(id) ?? '' }))
}
