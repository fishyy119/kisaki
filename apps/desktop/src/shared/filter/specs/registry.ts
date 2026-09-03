/**
 * Filter query spec registry.
 *
 * Resolves the per-entity FilterQuerySpec and spec-derived lookups.
 */
import { getTableName } from 'drizzle-orm'
import type { AllEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import type { FilterState } from '../model'
import type { EntitySort } from '../sort'
import type { FilterQuerySpec } from '../spec'

import { animeFilterQuerySpec } from './anime'
import { characterFilterQuerySpec } from './character'
import { collectionFilterQuerySpec } from './collection'
import { comicFilterQuerySpec } from './comic'
import { companyFilterQuerySpec } from './company'
import { gameFilterQuerySpec } from './game'
import { novelFilterQuerySpec } from './novel'
import { personFilterQuerySpec } from './person'
import { tagFilterQuerySpec } from './tag'

export function getFilterQuerySpec(entityType: AllEntityType): FilterQuerySpec {
  switch (entityType) {
    case 'game':
      return gameFilterQuerySpec
    case 'anime':
      return animeFilterQuerySpec
    case 'comic':
      return comicFilterQuerySpec
    case 'novel':
      return novelFilterQuerySpec
    case 'character':
      return characterFilterQuerySpec
    case 'person':
      return personFilterQuerySpec
    case 'company':
      return companyFilterQuerySpec
    case 'collection':
      return collectionFilterQuerySpec
    case 'tag':
      return tagFilterQuerySpec
  }
}

/**
 * Upper bound of the tables any query over the entity type can depend on:
 * the entity table itself plus every relation link table in its spec. For a
 * caller that knows the query instance, `getQueryDependencyTables` is exact.
 */
export function getFilterRelevantTables(entityType: AllEntityType): readonly TableName[] {
  return getFilterQuerySpec(entityType).relevantTables
}

/** The query inputs that decide which tables a filtered entity query reads. */
export interface QueryDependencyInputs {
  filter?: FilterState | null
  sort?: EntitySort | null
}

/**
 * Tables one filtered entity query reads: the entity table (search, scope,
 * NSFW visibility, and column sorts all live there) plus the link table of
 * every relation field an active condition references. A relation field no
 * condition uses is not a dependency: result rows carry no link data, so a
 * change in that link table cannot change the result.
 */
export function getQueryDependencyTables(
  entityType: AllEntityType,
  query: QueryDependencyInputs
): readonly TableName[] {
  const spec = getFilterQuerySpec(entityType)
  const tables = new Set<TableName>([spec.tableName])

  for (const condition of query.filter?.conditions ?? []) {
    const field = spec.fieldByKey.get(condition.field)
    if (field?.kind === 'relation') {
      tables.add(getTableName(field.link.table) as TableName)
    }
  }

  return [...tables]
}
