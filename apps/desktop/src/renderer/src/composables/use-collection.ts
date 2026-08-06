/**
 * Collection data composable
 *
 * Provides collection data with entities using Provider/Consumer pattern.
 * Supports both static and dynamic collections.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * route pages consume the navigation-time loader, dialogs fetch after mount.
 */

import {
  provide,
  inject,
  toRef,
  toValue,
  computed,
  ref,
  watch,
  type InjectionKey,
  type Ref,
  type MaybeRefOrGetter,
  type ComputedRef
} from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { eq, count, asc, and, type SQL } from 'drizzle-orm'
import {
  db,
  countEntities,
  queryEntities,
  COLLECTION_LINKS,
  ENTITY_TABLES
} from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import { getFilterRelevantTables } from '@shared/filter'
import type { Collection } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import type { DynamicCollectionConfig } from '@shared/db/contracts/json'
import type { ContentEntityType } from '@shared/common'
import { CONTENT_ENTITY_TYPES } from '@shared/common'
import type { ContentEntityData, ContentEntityCounts } from './types'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

interface CollectionCountsData {
  collection: Collection | null
  counts: ContentEntityCounts
  configuredTypes: ContentEntityType[]
}

interface CollectionData {
  collection: Collection
  counts: ContentEntityCounts
  configuredTypes: ContentEntityType[]
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

export interface CollectionContext {
  /** Collection data */
  collection: ComputedRef<Collection | null>
  /** Entities in the collection for current entity type */
  entities: ComputedRef<ContentEntityData[]>
  /** Current entity type being viewed */
  entityType: ComputedRef<ContentEntityType>
  /** Entity counts for all types */
  entityCounts: ComputedRef<ContentEntityCounts>
  /** For dynamic collections, which entity types have config */
  configuredEntityTypes: ComputedRef<ContentEntityType[]>
  /** Change the current entity type */
  setEntityType: (type: ContentEntityType) => void
  /** Initial loading state */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

// =============================================================================
// Injection Key
// =============================================================================

export const CollectionKey: InjectionKey<CollectionContext> = Symbol('collection')

// =============================================================================
// Helper Functions
// =============================================================================

function getConfiguredEntityTypes(config: DynamicCollectionConfig | null): ContentEntityType[] {
  if (!config) return []
  return CONTENT_ENTITY_TYPES.filter((type) => config[type].enabled)
}

/** First configured type with items, otherwise the first configured type. */
function getDefaultEntityType(
  counts: ContentEntityCounts,
  configured: ContentEntityType[]
): ContentEntityType {
  const candidates = configured.length > 0 ? configured : CONTENT_ENTITY_TYPES
  return candidates.find((type) => counts[type] > 0) ?? candidates[0]
}

function createEmptyCounts(): ContentEntityCounts {
  return { game: 0, character: 0, person: 0, company: 0 }
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/** Counts entities linked to a static collection, honoring NSFW visibility. */
async function countStaticEntities(
  type: ContentEntityType,
  collectionId: string,
  showNsfw: boolean
): Promise<number> {
  const link = COLLECTION_LINKS[type]
  const entity = ENTITY_TABLES[type]

  const parts: SQL[] = [eq(link.collectionIdColumn, collectionId)]
  if (!showNsfw) parts.push(eq(entity.isNsfwColumn, false))

  const rows = await db
    .select({ value: count() })
    .from(link.table)
    .innerJoin(entity.table, eq(link.entityIdColumn, entity.idColumn))
    .where(and(...parts))
  return rows[0]?.value ?? 0
}

async function fetchCollectionWithCounts(
  collectionId: string,
  showNsfw: boolean
): Promise<CollectionCountsData> {
  // Fetch collection first
  const collectionWhere = and(
    eq(schema.collections.id, collectionId),
    showNsfw ? undefined : eq(schema.collections.isNsfw, false)
  )
  const [collectionData] = await db
    .select()
    .from(schema.collections)
    .where(collectionWhere)
    .limit(1)

  if (!collectionData) {
    return {
      collection: null,
      counts: createEmptyCounts(),
      configuredTypes: [...CONTENT_ENTITY_TYPES]
    }
  }

  const isDynamic = collectionData.isDynamic
  const dynamicConfig = collectionData.dynamicConfig

  // Determine configured entity types
  const configuredTypes = isDynamic
    ? getConfiguredEntityTypes(dynamicConfig)
    : [...CONTENT_ENTITY_TYPES]

  const counts = createEmptyCounts()

  if (isDynamic && dynamicConfig) {
    await Promise.all(
      configuredTypes.map(async (type) => {
        counts[type] = await countEntities(type, {
          filter: dynamicConfig[type].filter,
          includeNsfw: showNsfw
        })
      })
    )
  } else if (!isDynamic) {
    await Promise.all(
      CONTENT_ENTITY_TYPES.map(async (type) => {
        counts[type] = await countStaticEntities(type, collectionId, showNsfw)
      })
    )
  }

  return { collection: collectionData, counts, configuredTypes }
}

async function fetchCollectionEntities(
  collection: Collection | null,
  collectionId: string,
  entityType: ContentEntityType,
  showNsfw: boolean
): Promise<ContentEntityData[]> {
  if (!collection) return []

  const dynamicConfig = collection.dynamicConfig

  if (collection.isDynamic && dynamicConfig) {
    const entityConfig = dynamicConfig[entityType]
    if (!entityConfig.enabled) return []

    return await queryEntities(entityType, {
      filter: entityConfig.filter,
      sortField: entityConfig.sortField,
      sortDirection: entityConfig.sortDirection,
      includeNsfw: showNsfw
    })
  }

  // Static collection - fetch via link table in collection order
  const link = COLLECTION_LINKS[entityType]
  const entity = ENTITY_TABLES[entityType]

  const parts: SQL[] = [eq(link.collectionIdColumn, collectionId)]
  if (!showNsfw) parts.push(eq(entity.isNsfwColumn, false))

  const rows = await db
    .select({ entity: entity.table })
    .from(link.table)
    .innerJoin(entity.table, eq(link.entityIdColumn, entity.idColumn))
    .where(and(...parts))
    .orderBy(asc(link.orderColumn))

  return rows.map((row) => row.entity) as ContentEntityData[]
}

function resolveEntityType(
  selectedType: ContentEntityType | null,
  counts: ContentEntityCounts,
  configuredTypes: ContentEntityType[],
  isDynamic: boolean
): ContentEntityType {
  let type = selectedType ?? getDefaultEntityType(counts, configuredTypes)
  // Ensure the selected type is valid for dynamic collections
  if (isDynamic && configuredTypes.length > 0 && !configuredTypes.includes(type)) {
    type = configuredTypes[0]
  }
  return type
}

async function fetchCollectionData(
  collectionId: string,
  selectedType: ContentEntityType | null,
  showNsfw: boolean
): Promise<CollectionData | null> {
  const { collection, counts, configuredTypes } = await fetchCollectionWithCounts(
    collectionId,
    showNsfw
  )
  if (!collection) return null

  const entityType = resolveEntityType(selectedType, counts, configuredTypes, collection.isDynamic)
  const entities = await fetchCollectionEntities(collection, collectionId, entityType, showNsfw)

  return { collection, counts, configuredTypes, entityType, entities }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface entity type selection lives beside the loader so the
// navigation-time fetch reads a consistent value; it resets whenever a
// different collection loads.
let lastRouteCollectionId: string | null = null
const routeSelectedType = ref<ContentEntityType | null>(null)

export const collectionDetailData = defineRouteData((route) => {
  const collectionId = route.params.collectionId as string
  if (collectionId !== lastRouteCollectionId) {
    lastRouteCollectionId = collectionId
    routeSelectedType.value = null
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchCollectionData(collectionId, routeSelectedType.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface CollectionDataSource {
  data: Readonly<Ref<CollectionData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
  setEntityType: (type: ContentEntityType) => void
}

function provideCollectionContext(source: CollectionDataSource): CollectionContext {
  const context: CollectionContext = {
    collection: computed(() => source.data.value?.collection ?? null),
    entities: computed(() => source.data.value?.entities ?? []),
    entityType: computed(() => source.data.value?.entityType ?? 'game'),
    entityCounts: computed(
      () => source.data.value?.counts ?? { game: 0, character: 0, person: 0, company: 0 }
    ),
    configuredEntityTypes: computed(
      () => source.data.value?.configuredTypes ?? [...CONTENT_ENTITY_TYPES]
    ),
    setEntityType: source.setEntityType,
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(CollectionKey, context)

  return context
}

function useCollectionDbSync(
  collectionId: MaybeRefOrGetter<string>,
  context: CollectionContext,
  refetch: () => Promise<void>
): void {
  const isDynamic = computed(() => context.collection.value?.isDynamic ?? false)

  // Counts cover every content type, so membership links of all types are
  // relevant. Dynamic collections additionally depend on every table their
  // filters can reference (entity tables + relation link tables).
  const relevantTables = computed(() => {
    const tables = new Set<TableName>()
    for (const type of CONTENT_ENTITY_TYPES) {
      tables.add(COLLECTION_LINKS[type].tableName)
      if (isDynamic.value) {
        for (const table of getFilterRelevantTables(type)) tables.add(table)
      } else {
        tables.add(ENTITY_TABLES[type].tableName)
      }
    }
    return tables
  })

  useDbChanges(({ table, id: changedId }) => {
    if (table === 'collections') {
      if (changedId === toValue(collectionId)) refetch()
      return
    }
    if (relevantTables.value.has(table)) refetch()
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide collection data on the route surface (data settled during navigation).
 * Entity type switching triggers a non-blocking SWR refetch.
 */
export function useCollectionRouteProvider(): CollectionContext {
  const route = useRoute()
  const collectionId = computed(() => route.params.collectionId as string)
  const { data, error, isFetching, refetch } = collectionDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const setEntityType = (type: ContentEntityType) => {
    routeSelectedType.value = type
    void refetch()
  }

  const context = provideCollectionContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch,
    setEntityType
  })
  useCollectionDbSync(collectionId, context, refetch)

  return context
}

/**
 * Provide collection data on the dialog surface (fetches after mount).
 */
export function useCollectionDialogProvider(
  collectionId: MaybeRefOrGetter<string>
): CollectionContext {
  const id = toRef(collectionId)
  const selectedType = ref<ContentEntityType | null>(null)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchCollectionData(toValue(id), selectedType.value, showNsfw.value),
    { watch: [id, selectedType, showNsfw] }
  )

  const setEntityType = (type: ContentEntityType) => {
    selectedType.value = type
  }

  const context = provideCollectionContext({
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    setEntityType
  })
  useCollectionDbSync(id, context, refetch)

  return context
}

// =============================================================================
// Consumer Composable
// =============================================================================

export function useCollection(): CollectionContext {
  const context = inject(CollectionKey)
  if (!context) {
    throw new Error(
      'useCollection() must be used within a component that provided the collection context'
    )
  }
  return context
}
