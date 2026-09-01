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
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import type { Collection } from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { getFilterRelevantTables } from '@shared/filter'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from './content-entities'
import {
  createEntityDetailContext,
  type EntityDetailContext,
  type EntityDetailProviderReturn
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
 * Every link table feeds a static count and every entity table can hide a
 * member; a dynamic collection's counts depend on every table its filters can
 * reference; the browsed type's filter tables feed the visible list.
 */
function collectionRelevantTables(data: CollectionData | null): readonly TableName[] {
  const tables = new Set<TableName>()
  const isDynamic = data?.collection?.isDynamic ?? false
  for (const type of CONTENT_ENTITY_TYPES) {
    tables.add(COLLECTION_LINKS[type].tableName)
    tables.add(ENTITY_TABLES[type].tableName)
    if (isDynamic) {
      for (const table of getFilterRelevantTables(type)) tables.add(table)
    }
  }
  if (data) {
    for (const table of getFilterRelevantTables(data.entityType)) tables.add(table)
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
  relevantTables: collectionRelevantTables,
  entityTable: 'collections'
})

export const collectionDetailData = collectionDetail.detailData
export const useCollectionRouteProvider = collectionDetail.useRouteProvider
export const useCollectionDialogProvider = collectionDetail.useDialogProvider
export const useCollection = collectionDetail.useContext
