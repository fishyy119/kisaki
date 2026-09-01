/**
 * Explorer list data.
 *
 * Fetches the entity list the LibraryExplorer shows, applying search and
 * filter from the explorer store. Supports both static collections
 * (link-based) and dynamic collections (filter-based).
 *
 * Provider/consumer: the explorer root creates the state once and provides
 * it; list, footer, and locator all read the same fetch instead of issuing
 * their own.
 */

import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  db,
  buildDynamicCollectionScope,
  queryEntities,
  queryEntityIds,
  COLLECTION_LINKS,
  type EntityRowMap
} from '@renderer/core/db'
import { batchTouchesAny, useAsyncData, useDbChanges } from '@renderer/composables'
import { useLibraryExplorerStore } from '../stores'
import { usePreferencesStore } from '@renderer/stores'
import { createMembershipSort, getFilterRelevantTables, isMembershipSort } from '@shared/filter'
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

export interface ExplorerListContext {
  /** Fetched data with an empty default, always safe to render from. */
  data: ComputedRef<ExplorerListData>
  /** Raw fetch result; undefined until the first fetch lands. */
  rawData: Ref<ExplorerListData | undefined>
  /** Deduplicated flat list across all groups; the filter-mode row source. */
  allEntities: ComputedRef<EntityData[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  refetch: () => Promise<void>
}

const ExplorerListKey: InjectionKey<ExplorerListContext> = Symbol('explorerList')

// =============================================================================
// Composable
// =============================================================================

function createExplorerList(): ExplorerListContext {
  const store = useLibraryExplorerStore()
  const { activeEntityType, query } = storeToRefs(store)

  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  async function fetchExplorerData(): Promise<ExplorerListData> {
    const entityType = activeEntityType.value
    // Membership: each group keeps its collection's own order and the base
    // list falls to the spec default; a field key ranks every list alike.
    const keepsCollectionOrder = isMembershipSort(query.value.sort)

    // Fetch entities matching the current search/filter/sort
    const entities = await queryEntities(entityType, {
      filter: query.value.filter,
      search: query.value.search,
      sort: query.value.sort,
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
    const byRank = (a: EntityData, b: EntityData) =>
      (rankById.get(a.id) ?? 0) - (rankById.get(b.id) ?? 0)

    // Group entities by collection
    const linkedEntityIds = new Set<string>()
    const collectionGroups: CollectionGroup[] = []

    for (const collection of allCollections) {
      if (collection.isDynamic) {
        // Dynamic collection: query ids in the configured order, then
        // intersect with the current search/filter result set
        const dynamicConfig = collection.dynamicConfig
        if (!dynamicConfig) continue

        const entityConfig = dynamicConfig[entityType]
        if (!entityConfig.enabled) continue

        const dynamicIds = await queryEntityIds(entityType, {
          scope: buildDynamicCollectionScope(entityType, entityConfig),
          sort: createMembershipSort(),
          includeNsfw: showNsfw.value
        })

        const filteredEntities = dynamicIds
          .map((id) => entityMap.get(id))
          .filter((entity): entity is EntityData => entity !== undefined)
        if (!keepsCollectionOrder) filteredEntities.sort(byRank)

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

        if (keepsCollectionOrder) {
          collectionEntities.sort(
            (a, b) => (entityOrderMap.get(a.id) ?? 0) - (entityOrderMap.get(b.id) ?? 0)
          )
        } else {
          collectionEntities.sort(byRank)
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

  // Fetch on mount and on any query change (the query replaces wholesale)
  const { data, isLoading, isFetching, refetch } = useAsyncData(fetchExplorerData, {
    watch: [query, showNsfw]
  })

  // Listen for DB events: entity table, relation link tables (filters and
  // dynamic configs), collections, and the collection membership link table
  const relevantTables = computed(() => {
    const tables = new Set(getFilterRelevantTables(activeEntityType.value))
    tables.add('collections')
    tables.add(COLLECTION_LINKS[activeEntityType.value].tableName)
    return tables
  })

  useDbChanges((batch) => {
    if (batchTouchesAny(batch, relevantTables.value)) refetch()
  })

  // Computed data with default for UI rendering
  const explorerData = computed<ExplorerListData>(
    () => data.value ?? { collections: [], uncategorized: [], totalCount: 0 }
  )

  // Deduplicated flat list: the same entity appears once per containing
  // collection in the grouped view, but the filter-mode view is per entity.
  const allEntities = computed(() => {
    const seenIds = new Set<string>()
    return [
      ...explorerData.value.collections.flatMap((c) => c.entities),
      ...explorerData.value.uncategorized
    ].filter((entity) => {
      if (seenIds.has(entity.id)) return false
      seenIds.add(entity.id)
      return true
    })
  })

  return {
    data: explorerData,
    rawData: data,
    allEntities,
    isLoading,
    isFetching,
    refetch
  }
}

/** Creates the explorer list state and provides it to the explorer subtree. */
export function useExplorerListProvider(): ExplorerListContext {
  const context = createExplorerList()
  provide(ExplorerListKey, context)
  return context
}

/** Consumes the provided explorer list state. */
export function useExplorerList(): ExplorerListContext {
  const context = inject(ExplorerListKey)
  if (!context) {
    throw new Error('useExplorerList() must be used inside a LibraryExplorer subtree')
  }
  return context
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
