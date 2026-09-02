/**
 * Entity query scopes.
 *
 * A scope is what a library surface fixes before the user's own query applies:
 * the members of a tag or a collection, a dynamic collection's configured
 * filter and order, the rows no collection holds, the favorites. The executor
 * ANDs a scope with the user query, so a user `match: 'any'` can never OR the
 * scope away, and the scope's own member order is what the membership sort
 * key selects.
 */
import { eq, sql, type SQL } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { ContentEntityType } from '@shared/entity-types'
import { collections } from '@shared/db'
import type { DynamicEntityConfig } from '@shared/db/contracts/json'
import { buildOrderBy, getFilterQuerySpec, type FilterState } from '@shared/filter'
import { COLLECTION_LINKS } from './collection-links'
import { ENTITY_TABLES } from './entity-tables'
import { TAG_LINKS } from './tag-links'

export interface EntityScope {
  /** Caller-owned base constraint, AND-ed with the user query. */
  where?: SQL
  /** Scope-defining filter, AND-ed with the user filter. */
  filter?: FilterState
  /**
   * The scope's own member order as a complete ORDER BY expression; the
   * membership sort key selects it. A scope without one falls back to the
   * entity spec's default order.
   */
  order?: SQL
}

/** An owner-entity link table seen from the entity side. */
interface MembershipLink {
  table: SQLiteTable
  entityIdColumn: SQLiteColumn
  ownerIdColumn: SQLiteColumn
  orderColumn: SQLiteColumn
}

/**
 * Membership over one link table. Both fragments correlate on the outer
 * entity row; the `(owner, entity)` unique constraint every link table carries
 * keeps the order subquery single-valued.
 */
function buildMembershipScope(
  entityType: ContentEntityType,
  link: MembershipLink,
  ownerId: string
): EntityScope {
  const entity = ENTITY_TABLES[entityType]
  const member = sql`${link.table} where ${eq(link.entityIdColumn, entity.idColumn)} and ${eq(link.ownerIdColumn, ownerId)}`

  return {
    where: sql`exists (select 1 from ${member})`,
    order: sql`(select ${link.orderColumn} from ${member}) asc`
  }
}

/** Entities carrying the tag, in the tag's own order. */
export function buildTagMembershipScope(entityType: ContentEntityType, tagId: string): EntityScope {
  const link = TAG_LINKS[entityType]
  return buildMembershipScope(
    entityType,
    {
      table: link.table,
      entityIdColumn: link.entityIdColumn,
      ownerIdColumn: link.tagIdColumn,
      orderColumn: link.orderInTagColumn
    },
    tagId
  )
}

/** Entities linked to a static collection, in the collection's own order. */
export function buildCollectionMembershipScope(
  entityType: ContentEntityType,
  collectionId: string
): EntityScope {
  const link = COLLECTION_LINKS[entityType]
  return buildMembershipScope(
    entityType,
    {
      table: link.table,
      entityIdColumn: link.entityIdColumn,
      ownerIdColumn: link.collectionIdColumn,
      orderColumn: link.orderColumn
    },
    collectionId
  )
}

/** A dynamic collection's configured filter and order for one entity type. */
export function buildDynamicCollectionScope(
  entityType: ContentEntityType,
  config: DynamicEntityConfig
): EntityScope {
  const spec = getFilterQuerySpec(entityType)
  return {
    filter: config.filter,
    order: buildOrderBy(spec, config.sortField, config.sortDirection)
  }
}

/**
 * Entities no visible collection holds. Hidden (NSFW) collections do not
 * count as a home, matching how the explorer and the default browse context
 * group entities.
 */
export function buildUncategorizedScope(
  entityType: ContentEntityType,
  includeNsfw: boolean
): EntityScope {
  const entity = ENTITY_TABLES[entityType]
  const link = COLLECTION_LINKS[entityType]

  const membership: SQL[] = [eq(link.entityIdColumn, entity.idColumn)]
  if (!includeNsfw) membership.push(eq(collections.isNsfw, false))

  return {
    where: sql`not exists (select 1 from ${link.table} inner join ${collections} on ${eq(link.collectionIdColumn, collections.id)} where ${sql.join(membership, sql` and `)})`
  }
}

/** Favorites; `isFavorite` is declared by every content entity spec. */
export const FAVORITES_SCOPE: EntityScope = {
  filter: { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] }
}
