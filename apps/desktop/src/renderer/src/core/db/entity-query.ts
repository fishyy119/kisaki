/**
 * Entity query executor.
 *
 * Single renderer-side implementation for scoped filter/search/sort entity
 * queries. NSFW visibility, scope + filter + search composition, and ordering
 * are owned here; the row-type cast below is the module's one controlled
 * unsafe point.
 */
import { and, count, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type { AllEntityType } from '@shared/common'
import {
  buildFilterConditions,
  buildOrderBy,
  getFilterQuerySpec,
  isMembershipSort,
  type EntitySort,
  type FilterQuerySpec,
  type FilterState
} from '@shared/filter'
import { buildSearchCondition, getSearchQuerySpec } from '@shared/search'
import type { EntityScope } from './entity-scope'
import { ENTITY_TABLES, type EntityRowMap } from './entity-tables'
import { db } from './proxy'

export interface EntityQueryOptions {
  /** What the surface fixes before the user's query applies; always AND-ed. */
  scope?: EntityScope
  filter?: FilterState
  search?: string | null
  /**
   * Omitted: the spec default order. Membership: the scope's own order, or
   * the spec default when the scope has none; its direction is ignored.
   */
  sort?: EntitySort
  limit?: number
  includeNsfw: boolean
}

function buildWhere(entityType: AllEntityType, options: EntityQueryOptions): SQL | undefined {
  const spec = getFilterQuerySpec(entityType)
  const parts: SQL[] = []

  if (options.scope?.where) parts.push(options.scope.where)
  if (options.scope?.filter) {
    const scopeWhere = buildFilterConditions(spec, options.scope.filter)
    if (scopeWhere) parts.push(scopeWhere)
  }
  if (options.filter) {
    const filterWhere = buildFilterConditions(spec, options.filter)
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

function buildDefaultOrder(spec: FilterQuerySpec): SQL {
  return buildOrderBy(spec, spec.sort.defaultKey, 'asc')
}

function buildOrder(entityType: AllEntityType, options: EntityQueryOptions): SQL {
  const spec = getFilterQuerySpec(entityType)
  const sort = options.sort

  if (!sort) return buildDefaultOrder(spec)
  if (isMembershipSort(sort)) return options.scope?.order ?? buildDefaultOrder(spec)
  return buildOrderBy(spec, sort.key, sort.direction)
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

/** Loads one entity row by id, or null when no row owns that id. */
export async function queryEntityRow<T extends AllEntityType>(
  entityType: T,
  id: string
): Promise<EntityRowMap[T] | null> {
  const def = ENTITY_TABLES[entityType]

  const rows = await db.select().from(def.table).where(eq(def.idColumn, id)).limit(1)
  return (rows[0] as EntityRowMap[T] | undefined) ?? null
}

export async function countEntities(
  entityType: AllEntityType,
  options: Omit<EntityQueryOptions, 'sort' | 'limit'>
): Promise<number> {
  const def = ENTITY_TABLES[entityType]

  let query = db.select({ value: count() }).from(def.table).$dynamic()

  const where = buildWhere(entityType, options)
  if (where) query = query.where(where)

  const rows = await query
  return rows[0]?.value ?? 0
}

/** Projected picker row: what a selector or result list renders per entity. */
export interface EntityPickerRow {
  id: string
  name: string
  originalName: string | null
  imageFile: string | null
}

/**
 * Loads picker rows under the same scope/filter/sort semantics as
 * `queryEntities`, projected to display columns so selectors never ship whole
 * rows over IPC.
 */
export async function queryEntityPickerRows(
  entityType: AllEntityType,
  options: EntityQueryOptions
): Promise<EntityPickerRow[]> {
  const def = ENTITY_TABLES[entityType]

  let query = db
    .select({
      id: def.idColumn,
      name: def.nameColumn,
      originalName: def.originalNameColumn ?? sql<string | null>`null`,
      imageFile: def.imageColumn ?? sql<string | null>`null`
    })
    .from(def.table)
    .$dynamic()
    .orderBy(buildOrder(entityType, options))

  const where = buildWhere(entityType, options)
  if (where) query = query.where(where)
  if (options.limit !== undefined) query = query.limit(options.limit)

  const rows = await query
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    originalName: (row.originalName as string | null) ?? null,
    imageFile: (row.imageFile as string | null) ?? null
  }))
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
