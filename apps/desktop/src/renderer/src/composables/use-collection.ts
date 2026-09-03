/**
 * Collection data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what a collection
 * detail surface fetches and shows: the collection row, member counts per
 * content type, and the members of the browsed type under the surface's list
 * query. A static collection's members come from its link tables, a dynamic
 * collection's from its configured filters.
 */

import {
  COLLECTION_LINKS,
  ENTITY_TABLES,
  buildCollectionMembershipScope,
  buildDynamicCollectionScope,
  countEntities,
  queryEntities,
  queryEntityRow,
  type EntityScope
} from '@renderer/core/db'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import type { Collection } from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { getFilterRelevantTables, getQueryDependencyTables } from '@shared/filter'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from './content-entities'
import {
  createEntityDetailContext,
  type EntityDetailContext,
  type EntityDetailProviderReturn,
  type EntityDetailReadsContext
} from './entity-context'
import {
  createEntityListQuery,
  resolveEntityListType,
  type EntityListQuery,
  type OrganizerDetailParams
} from './entity-list-query'

// =============================================================================
// Types
// =============================================================================

export interface CollectionData {
  collection: Collection | null
  /** Members per content type, unfiltered. */
  counts: ContentEntityCounts
  /** Types a dynamic collection is configured for; every type for a static one. */
  configuredTypes: ContentEntityType[]
  /** Type actually shown; the query only carries the request. */
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

export type CollectionContext = EntityDetailContext<CollectionData>
export type CollectionProviderReturn = EntityDetailProviderReturn<
  CollectionData,
  OrganizerDetailParams
>

// =============================================================================
// Data Fetcher
// =============================================================================

function getConfiguredEntityTypes(collection: Collection): ContentEntityType[] {
  if (!collection.isDynamic) return [...CONTENT_ENTITY_TYPES]
  const config = collection.dynamicConfig
  if (!config) return []
  return CONTENT_ENTITY_TYPES.filter((type) => config[type].enabled)
}

/** The collection's member scope for one type; null when a dynamic collection leaves the type out. */
function buildCollectionScope(collection: Collection, type: ContentEntityType): EntityScope | null {
  if (!collection.isDynamic) return buildCollectionMembershipScope(type, collection.id)
  const config = collection.dynamicConfig?.[type]
  return config?.enabled ? buildDynamicCollectionScope(type, config) : null
}

async function fetchCollectionData(
  collectionId: string,
  query: EntityListQuery,
  showNsfw: boolean
): Promise<CollectionData | null> {
  const collection = await queryEntityRow('collection', collectionId)
  // A hidden collection reads as missing, so both surfaces fall through to not-found.
  if (!collection || (collection.isNsfw && !showNsfw)) return null

  const configuredTypes = getConfiguredEntityTypes(collection)

  const counts = createEmptyContentEntityCounts()
  await Promise.all(
    CONTENT_ENTITY_TYPES.map(async (type) => {
      const scope = buildCollectionScope(collection, type)
      if (scope) counts[type] = await countEntities(type, { scope, includeNsfw: showNsfw })
    })
  )

  const entityType = resolveEntityListType(query.entityType, counts, configuredTypes)
  const scope = buildCollectionScope(collection, entityType)
  const entities = scope
    ? await queryEntities(entityType, {
        scope,
        search: query.search,
        filter: query.filter,
        sort: query.sort,
        includeNsfw: showNsfw
      })
    : []

  return { collection, counts, configuredTypes, entityType, entities }
}

/**
 * What the fetch reads. Link rows attribute to the collection through their
 * foreign key, so a static collection only refetches for its own membership
 * changes; every entity table can hide a member and matches by table. A
 * dynamic collection's counts read the tables its configured filters
 * reference, and the visible list reads the shown type's query tables. Until
 * the row is known the declaration answers with the upper bound.
 */
function collectionReads({
  params,
  data
}: EntityDetailReadsContext<CollectionData, OrganizerDetailParams>): readonly TableName[] {
  const tables = new Set<TableName>()
  const collection = data?.collection ?? null

  for (const type of CONTENT_ENTITY_TYPES) {
    tables.add(ENTITY_TABLES[type].tableName)
    if (!collection || !collection.isDynamic) tables.add(COLLECTION_LINKS[type].tableName)
    if (!collection) {
      for (const table of getFilterRelevantTables(type)) tables.add(table)
    } else if (collection.isDynamic) {
      const config = collection.dynamicConfig?.[type]
      if (config?.enabled) {
        for (const table of getQueryDependencyTables(type, { filter: config.filter })) {
          tables.add(table)
        }
      }
    }
  }

  const shownType = data?.entityType ?? params.query.entityType
  for (const type of shownType ? [shownType] : CONTENT_ENTITY_TYPES) {
    for (const table of getQueryDependencyTables(type, params.query)) tables.add(table)
  }

  return [...tables]
}

// =============================================================================
// Context
// =============================================================================

const collectionDetail = createEntityDetailContext<CollectionData, OrganizerDetailParams>({
  entityType: 'collection',
  empty: {
    collection: null,
    counts: createEmptyContentEntityCounts(),
    configuredTypes: [...CONTENT_ENTITY_TYPES],
    entityType: 'game',
    entities: []
  },
  initialParams: () => ({ query: createEntityListQuery(null) }),
  fetch: (id, params, view) => fetchCollectionData(id, params.query, view.showNsfw),
  reads: collectionReads
})

export const collectionDetailData = collectionDetail.detailData
export const useCollectionRouteProvider = collectionDetail.useRouteProvider
export const useCollectionDialogProvider = collectionDetail.useDialogProvider
export const useCollection = collectionDetail.useContext
