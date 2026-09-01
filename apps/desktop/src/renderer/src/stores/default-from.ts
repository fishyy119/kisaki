/**
 * Default From Store
 *
 * Precomputes and maintains the "canonical" from value for each entity.
 * This determines which collection an entity should highlight in the explorer
 * when navigating without explicit context.
 *
 * Design: Separated handling for static and dynamic collections
 *
 * Static collections (link-based):
 * - Precomputed from link tables
 * - Listen to: collection_*_links, collections (order changes)
 *
 * Dynamic collections (filter-based):
 * - Precomputed by evaluating filters
 * - Listen to: collections (dynamicConfig) plus every filter-relevant table
 *   (entity tables and relation link tables), with debounce
 *
 * Query: O(1) - compare both maps, return lower order
 */

import { defineStore } from 'pinia'
import { ref, readonly, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { and, eq, type SQL } from 'drizzle-orm'
import {
  db,
  queryEntityIds,
  buildDynamicCollectionScope,
  COLLECTION_LINKS,
  ENTITY_TABLES
} from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { formatExplorerContext } from '@renderer/utils/explorer-context'
import { getFilterRelevantTables } from '@shared/filter'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import type { Collection } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { usePreferencesStore } from './preferences'

// Entry with order for comparison
interface FromEntry {
  collectionId: string
  order: number
}

type FromMap = Map<string, FromEntry>

function createFromMapByType(): Map<ContentEntityType, Ref<FromMap>> {
  return new Map(CONTENT_ENTITY_TYPES.map((type) => [type, ref<FromMap>(new Map())]))
}

export const useDefaultFromStore = defineStore('defaultFrom', () => {
  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  // =========================================================================
  // State: Separated maps for static and dynamic collections
  // =========================================================================

  const staticFroms = createFromMapByType()
  const dynamicFroms = createFromMapByType()

  const isInitialized = ref(false)

  // Recompute maps when NSFW visibility changes
  watch(showNsfw, async () => {
    if (!isInitialized.value) return
    await Promise.all([refetchAllStatic(), refetchAllDynamic()])
  })

  function getStaticMap(entityType: ContentEntityType): Ref<FromMap> {
    return staticFroms.get(entityType) as Ref<FromMap>
  }

  function getDynamicMap(entityType: ContentEntityType): Ref<FromMap> {
    return dynamicFroms.get(entityType) as Ref<FromMap>
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Get the default from value for an entity.
   * Compares static and dynamic entries, returns the one with lower order.
   */
  function getFrom(entityType: ContentEntityType, entityId: string): string {
    const staticEntry = getStaticMap(entityType).value.get(entityId)
    const dynamicEntry = getDynamicMap(entityType).value.get(entityId)

    // Both exist: compare orders
    if (staticEntry && dynamicEntry) {
      return toCollectionFrom(staticEntry.order <= dynamicEntry.order ? staticEntry : dynamicEntry)
    }

    // Only one exists
    if (staticEntry) return toCollectionFrom(staticEntry)
    if (dynamicEntry) return toCollectionFrom(dynamicEntry)

    // Neither: uncategorized
    return formatExplorerContext({ kind: 'uncategorized' })
  }

  function toCollectionFrom(entry: FromEntry): string {
    return formatExplorerContext({ kind: 'collection', collectionId: entry.collectionId })
  }

  /**
   * Initialize the store
   */
  async function init() {
    if (isInitialized.value) return
    await Promise.all([refetchAllStatic(), refetchAllDynamic()])
    isInitialized.value = true
    setupEventListeners()
  }

  // =========================================================================
  // Static collection handling
  // =========================================================================

  async function refetchAllStatic() {
    await Promise.all(CONTENT_ENTITY_TYPES.map((type) => refetchStaticType(type)))
  }

  async function refetchStaticType(entityType: ContentEntityType) {
    const target = getStaticMap(entityType)
    const newMap = new Map<string, FromEntry>()

    // Get all static collections ordered by order
    const collections = await db.query.collections.findMany({
      where: and(
        eq(schema.collections.isDynamic, false),
        showNsfw.value ? undefined : eq(schema.collections.isNsfw, false)
      ),
      orderBy: (c, { asc }) => asc(c.order)
    })

    // Create order lookup
    const orderMap = new Map(collections.map((c) => [c.id, c.order]))

    // Fetch links and assign by order
    const links = await fetchStaticLinks(entityType)

    // Sort by collection order
    links.sort((a, b) => {
      const orderA = orderMap.get(a.collectionId) ?? Infinity
      const orderB = orderMap.get(b.collectionId) ?? Infinity
      return orderA - orderB
    })

    // First collection wins for each entity
    for (const link of links) {
      if (!newMap.has(link.entityId)) {
        const order = orderMap.get(link.collectionId)
        if (order !== undefined) {
          newMap.set(link.entityId, { collectionId: link.collectionId, order })
        }
      }
    }

    target.value = newMap
  }

  async function fetchStaticLinks(
    entityType: ContentEntityType
  ): Promise<{ entityId: string; collectionId: string }[]> {
    const link = COLLECTION_LINKS[entityType]
    const entity = ENTITY_TABLES[entityType]

    const parts: SQL[] = []
    if (!showNsfw.value) parts.push(eq(entity.isNsfwColumn, false))

    let query = db
      .select({ entityId: link.entityIdColumn, collectionId: link.collectionIdColumn })
      .from(link.table)
      .innerJoin(entity.table, eq(link.entityIdColumn, entity.idColumn))
      .$dynamic()
    if (parts.length > 0) query = query.where(and(...parts))

    const rows = await query
    return rows.map((row) => ({
      entityId: row.entityId as string,
      collectionId: row.collectionId as string
    }))
  }

  // =========================================================================
  // Dynamic collection handling
  // =========================================================================

  async function refetchAllDynamic() {
    await Promise.all(CONTENT_ENTITY_TYPES.map((type) => refetchDynamicType(type)))
  }

  async function refetchDynamicType(entityType: ContentEntityType) {
    const target = getDynamicMap(entityType)
    const newMap = new Map<string, FromEntry>()

    // Get all dynamic collections ordered by order
    const collections = await db.query.collections.findMany({
      where: and(
        eq(schema.collections.isDynamic, true),
        showNsfw.value ? undefined : eq(schema.collections.isNsfw, false)
      ),
      orderBy: (c, { asc }) => asc(c.order)
    })

    // Process in order - first match wins
    for (const collection of collections) {
      const entityIds = await getDynamicCollectionEntities(collection, entityType)
      for (const entityId of entityIds) {
        if (!newMap.has(entityId)) {
          newMap.set(entityId, { collectionId: collection.id, order: collection.order })
        }
      }
    }

    target.value = newMap
  }

  async function getDynamicCollectionEntities(
    collection: Collection,
    entityType: ContentEntityType
  ): Promise<string[]> {
    const dynamicConfig = collection.dynamicConfig
    if (!dynamicConfig) return []

    const entityConfig = dynamicConfig[entityType]
    if (!entityConfig.enabled) return []

    // Membership only: the order of the ids is irrelevant to the map.
    return await queryEntityIds(entityType, {
      scope: buildDynamicCollectionScope(entityType, entityConfig),
      includeNsfw: showNsfw.value
    })
  }

  // =========================================================================
  // Event listeners
  // =========================================================================

  function setupEventListeners() {
    // Debounced per-type dynamic refetches for entity/link table changes
    const debouncedDynamicRefetch = new Map(
      CONTENT_ENTITY_TYPES.map((type) => [type, useDebounceFn(() => refetchDynamicType(type), 300)])
    )

    const handleStaticChange = (table: TableName) => {
      if (table === 'collections') {
        // Order might have changed - refetch all static
        void refetchAllStatic()
        return
      }
      for (const type of CONTENT_ENTITY_TYPES) {
        if (COLLECTION_LINKS[type].tableName === table) void refetchStaticType(type)
      }
    }

    const handleDynamicChange = (table: TableName) => {
      if (table === 'collections') {
        // dynamicConfig might have changed - refetch all dynamic
        void refetchAllDynamic()
        return
      }
      for (const type of CONTENT_ENTITY_TYPES) {
        if (getFilterRelevantTables(type).includes(table)) {
          void debouncedDynamicRefetch.get(type)?.()
        }
      }
    }

    ipcManager.on('db:changed', (_e, changes) => {
      for (const { operation, table } of changes) {
        // Static: inserted/deleted links, plus collections updates (order changes)
        if (operation !== 'updated' || table === 'collections') {
          handleStaticChange(table)
        }
        handleDynamicChange(table)
      }
    })
  }

  return {
    isInitialized: readonly(isInitialized),
    getFrom,
    init,
    refetchAllStatic,
    refetchAllDynamic,
    refetchStaticType,
    refetchDynamicType
  }
})
