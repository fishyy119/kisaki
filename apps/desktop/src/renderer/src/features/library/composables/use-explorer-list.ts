/**
 * Composable: useExplorerList
 *
 * Fetches entity list data for the LibraryExplorer component.
 * Applies search and filter from the explorer store.
 * Supports both static collections (link-based) and dynamic collections (filter-based).
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  db,
  queryEntities,
  queryEntityIds,
  COLLECTION_LINKS,
  type EntityRowMap
} from '@renderer/core/db'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import { useLibraryExplorerStore } from '../stores'
import { usePreferencesStore } from '@renderer/stores'
import { getFilterRelevantTables } from '@shared/filter'
import type { ContentEntityType } from '@shared/common'

// =============================================================================
// Types
// =============================================================================

export type EntityData = EntityRowMap[ContentEntityType]

export interface CollectionGroup {
  id: string
  name: string
  coverFile: string | null
  isDynamic: boolean
  entities: EntityData[]
}

export interface ExplorerListData {
  collections: CollectionGroup[]
  uncategorized: EntityData[]
  totalCount: number
}

// =============================================================================
// Composable
// =============================================================================

export function useExplorerList() {
  const store = useLibraryExplorerStore()
  const { activeEntityType, search, filter, sortField, sortDirection, overrideCollectionOrder } =
    storeToRefs(store)

  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  async function fetchExplorerData(): Promise<ExplorerListData> {
    const entityType = activeEntityType.value

    // Fetch entities matching the current search/filter/sort
    const entities = await queryEntities(entityType, {
      filter: filter.value,
      search: search.value,
      sortField: sortField.value,
      sortDirection: sortDirection.value,
      includeNsfw: showNsfw.value
    })

    // Fetch all collections (both static and dynamic)
    const allCollections = await db.query.collections.findMany({
      ...(showNsfw.value ? {} : { where: (c, { eq }) => eq(c.isNsfw, false) }),
      orderBy: (c, { asc }) => asc(c.order)
    })

    // Fetch entity-collection links with order info (for static collections)
    const links = await fetchEntityCollectionLinks(entityType)
    // Map: collectionId -> { entityId -> orderInCollection }
    const linkMap = new Map<string, Map<string, number>>()
    for (const link of links) {
      const existing = linkMap.get(link.collectionId) || new Map()
      existing.set(link.entityId, link.orderInCollection)
      linkMap.set(link.collectionId, existing)
    }

    // Lookup maps: entity by id, and global sort rank by id
    const entityMap = new Map(entities.map((e) => [e.id, e]))
    const rankById = new Map(entities.map((e, index) => [e.id, index]))

    // Group entities by collection
    const linkedEntityIds = new Set<string>()
    const collectionGroups: CollectionGroup[] = []

    for (const collection of allCollections) {
      if (collection.isDynamic) {
        // Dynamic collection: query ids based on filter config, then
        // intersect with the current search/filter result set
        const dynamicConfig = collection.dynamicConfig
        if (!dynamicConfig) continue

        const entityConfig = dynamicConfig[entityType]
        if (!entityConfig.enabled) continue

        const dynamicIds = await queryEntityIds(entityType, {
          filter: entityConfig.filter,
          sortField: entityConfig.sortField,
          sortDirection: entityConfig.sortDirection,
          includeNsfw: showNsfw.value
        })

        const filteredEntities = dynamicIds
          .map((id) => entityMap.get(id))
          .filter((entity): entity is EntityData => entity !== undefined)

        if (filteredEntities.length > 0) {
          collectionGroups.push({
            id: collection.id,
            name: collection.name,
            coverFile: collection.coverFile,
            isDynamic: true,
            entities: filteredEntities
          })
          filteredEntities.forEach((e) => linkedEntityIds.add(e.id))
        }
      } else {
        // Static collection: use link tables
        const entityOrderMap = linkMap.get(collection.id)
        if (!entityOrderMap || entityOrderMap.size === 0) continue

        // Get entities that belong to this collection
        const collectionEntities: EntityData[] = []
        for (const entityId of entityOrderMap.keys()) {
          const entity = entityMap.get(entityId)
          if (entity) collectionEntities.push(entity)
        }

        // Sort based on override preference
        if (overrideCollectionOrder.value) {
          // Use global sort order from the main list
          collectionEntities.sort((a, b) => (rankById.get(a.id) ?? 0) - (rankById.get(b.id) ?? 0))
        } else {
          // Use collection internal order (orderInCollection)
          collectionEntities.sort(
            (a, b) => (entityOrderMap.get(a.id) ?? 0) - (entityOrderMap.get(b.id) ?? 0)
          )
        }

        if (collectionEntities.length > 0) {
          collectionGroups.push({
            id: collection.id,
            name: collection.name,
            coverFile: collection.coverFile,
            isDynamic: false,
            entities: collectionEntities
          })
          collectionEntities.forEach((e) => linkedEntityIds.add(e.id))
        }
      }
    }

    // Find uncategorized entities
    const uncategorized = entities.filter((e) => !linkedEntityIds.has(e.id))

    return {
      collections: collectionGroups,
      uncategorized,
      totalCount: entities.length
    }
  }

  // Fetch on mount and when filter/sort changes
  const { data, isLoading, isFetching, refetch } = useAsyncData(fetchExplorerData, {
    watch: [
      activeEntityType,
      search,
      filter,
      sortField,
      sortDirection,
      overrideCollectionOrder,
      showNsfw
    ]
  })

  // Listen for DB events: entity table, relation link tables (filters and
  // dynamic configs), collections, and the collection membership link table
  const relevantTables = computed(() => {
    const tables = new Set(getFilterRelevantTables(activeEntityType.value))
    tables.add('collections')
    tables.add(COLLECTION_LINKS[activeEntityType.value].tableName)
    return tables
  })

  useDbChanges(({ table }) => {
    if (relevantTables.value.has(table)) refetch()
  })

  // Computed data with default for UI rendering
  const explorerData = computed<ExplorerListData>(
    () => data.value ?? { collections: [], uncategorized: [], totalCount: 0 }
  )

  return {
    data: explorerData,
    rawData: data,
    isLoading,
    isFetching,
    refetch
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchEntityCollectionLinks(
  entityType: ContentEntityType
): Promise<{ collectionId: string; entityId: string; orderInCollection: number }[]> {
  const link = COLLECTION_LINKS[entityType]
  const rows = await db
    .select({
      collectionId: link.collectionIdColumn,
      entityId: link.entityIdColumn,
      orderInCollection: link.orderColumn
    })
    .from(link.table)

  return rows.map((row) => ({
    collectionId: row.collectionId as string,
    entityId: row.entityId as string,
    orderInCollection: row.orderInCollection as number
  }))
}
