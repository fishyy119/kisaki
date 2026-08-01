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
import { eq, count, asc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import { buildFilterConditions, buildOrderBy, getFilterQuerySpec } from '@shared/filter'
import type { Collection, Game, Character, Person, Company } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { DynamicCollectionConfig, DynamicEntityConfig } from '@shared/db/contracts/json'
import type { ContentEntityType, SortDirection } from '@shared/common'
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

function getLinkTableName(type: ContentEntityType): string {
  switch (type) {
    case 'game':
      return 'collectionGameLinks'
    case 'character':
      return 'collectionCharacterLinks'
    case 'person':
      return 'collectionPersonLinks'
    case 'company':
      return 'collectionCompanyLinks'
  }
}

function getConfiguredEntityTypes(config: DynamicCollectionConfig | null): ContentEntityType[] {
  if (!config) return []
  const types: ContentEntityType[] = []
  if (config.game?.enabled) types.push('game')
  if (config.character?.enabled) types.push('character')
  if (config.person?.enabled) types.push('person')
  if (config.company?.enabled) types.push('company')
  return types
}

function getDefaultEntityType(
  counts: ContentEntityCounts,
  configured: ContentEntityType[]
): ContentEntityType {
  // For dynamic collections, pick first configured type with items
  if (configured.length > 0 && configured.length < 4) {
    const firstConfigured = configured[0]
    return counts[firstConfigured] > 0 ? firstConfigured : configured[0]
  }
  // For static collections, pick type with most items
  const entries = Object.entries(counts) as [ContentEntityType, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted[0][1] > 0 ? sorted[0][0] : 'game'
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

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
      counts: { game: 0, character: 0, person: 0, company: 0 },
      configuredTypes: [...CONTENT_ENTITY_TYPES]
    }
  }

  const isDynamic = collectionData.isDynamic
  const dynamicConfig = collectionData.dynamicConfig

  // Determine configured entity types
  const configuredTypes = isDynamic
    ? getConfiguredEntityTypes(dynamicConfig)
    : [...CONTENT_ENTITY_TYPES]

  // Fetch counts based on collection type
  let counts: ContentEntityCounts

  if (isDynamic && dynamicConfig) {
    counts = { game: 0, character: 0, person: 0, company: 0 }
    const promises: Promise<void>[] = []

    if (dynamicConfig.game?.enabled) {
      promises.push(
        (async () => {
          const whereCondition = buildFilterConditions(
            getQuerySpec('game'),
            dynamicConfig.game.filter
          )
          const result = await db
            .select({ count: count() })
            .from(schema.games)
            .where(
              and(
                whereCondition as never,
                showNsfw ? undefined : eq(schema.games.isNsfw, false)
              ) as never
            )
          counts.game = Number(result[0]?.count ?? 0)
        })()
      )
    }

    if (dynamicConfig.character?.enabled) {
      promises.push(
        (async () => {
          const whereCondition = buildFilterConditions(
            getQuerySpec('character'),
            dynamicConfig.character.filter
          )
          const result = await db
            .select({ count: count() })
            .from(schema.characters)
            .where(
              and(
                whereCondition as never,
                showNsfw ? undefined : eq(schema.characters.isNsfw, false)
              ) as never
            )
          counts.character = Number(result[0]?.count ?? 0)
        })()
      )
    }

    if (dynamicConfig.person?.enabled) {
      promises.push(
        (async () => {
          const whereCondition = buildFilterConditions(
            getQuerySpec('person'),
            dynamicConfig.person.filter
          )
          const result = await db
            .select({ count: count() })
            .from(schema.persons)
            .where(
              and(
                whereCondition as never,
                showNsfw ? undefined : eq(schema.persons.isNsfw, false)
              ) as never
            )
          counts.person = Number(result[0]?.count ?? 0)
        })()
      )
    }

    if (dynamicConfig.company?.enabled) {
      promises.push(
        (async () => {
          const whereCondition = buildFilterConditions(
            getQuerySpec('company'),
            dynamicConfig.company.filter
          )
          const result = await db
            .select({ count: count() })
            .from(schema.companies)
            .where(
              and(
                whereCondition as never,
                showNsfw ? undefined : eq(schema.companies.isNsfw, false)
              ) as never
            )
          counts.company = Number(result[0]?.count ?? 0)
        })()
      )
    }

    await Promise.all(promises)
  } else {
    // Static collection - count via link tables
    const [[gameCountRow], [characterCountRow], [personCountRow], [companyCountRow]] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(schema.collectionGameLinks)
          .innerJoin(schema.games, eq(schema.collectionGameLinks.gameId, schema.games.id))
          .where(
            and(
              eq(schema.collectionGameLinks.collectionId, collectionId),
              showNsfw ? undefined : eq(schema.games.isNsfw, false)
            )
          ),
        db
          .select({ value: count() })
          .from(schema.collectionCharacterLinks)
          .innerJoin(
            schema.characters,
            eq(schema.collectionCharacterLinks.characterId, schema.characters.id)
          )
          .where(
            and(
              eq(schema.collectionCharacterLinks.collectionId, collectionId),
              showNsfw ? undefined : eq(schema.characters.isNsfw, false)
            )
          ),
        db
          .select({ value: count() })
          .from(schema.collectionPersonLinks)
          .innerJoin(schema.persons, eq(schema.collectionPersonLinks.personId, schema.persons.id))
          .where(
            and(
              eq(schema.collectionPersonLinks.collectionId, collectionId),
              showNsfw ? undefined : eq(schema.persons.isNsfw, false)
            )
          ),
        db
          .select({ value: count() })
          .from(schema.collectionCompanyLinks)
          .innerJoin(
            schema.companies,
            eq(schema.collectionCompanyLinks.companyId, schema.companies.id)
          )
          .where(
            and(
              eq(schema.collectionCompanyLinks.collectionId, collectionId),
              showNsfw ? undefined : eq(schema.companies.isNsfw, false)
            )
          )
      ])

    counts = {
      game: Number(gameCountRow?.value ?? 0),
      character: Number(characterCountRow?.value ?? 0),
      person: Number(personCountRow?.value ?? 0),
      company: Number(companyCountRow?.value ?? 0)
    }
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

  const isDynamic = collection.isDynamic
  const dynamicConfig = collection.dynamicConfig

  if (isDynamic && dynamicConfig) {
    const entityConfig = dynamicConfig[entityType] as DynamicEntityConfig | undefined
    if (!entityConfig?.enabled) return []

    const querySpec = getQuerySpec(entityType)
    const whereCondition = buildFilterConditions(querySpec, entityConfig.filter)
    const orderBy = buildOrderBy(
      querySpec,
      entityConfig.sortField,
      entityConfig.sortDirection as SortDirection
    )

    switch (entityType) {
      case 'game':
        return (await db.query.games.findMany({
          where: and(
            whereCondition as never,
            showNsfw ? undefined : eq(schema.games.isNsfw, false)
          ) as never,
          orderBy
        } as never)) as Game[]
      case 'character':
        return (await db.query.characters.findMany({
          where: and(
            whereCondition as never,
            showNsfw ? undefined : eq(schema.characters.isNsfw, false)
          ) as never,
          orderBy
        } as never)) as Character[]
      case 'person':
        return (await db.query.persons.findMany({
          where: and(
            whereCondition as never,
            showNsfw ? undefined : eq(schema.persons.isNsfw, false)
          ) as never,
          orderBy
        } as never)) as Person[]
      case 'company':
        return (await db.query.companies.findMany({
          where: and(
            whereCondition as never,
            showNsfw ? undefined : eq(schema.companies.isNsfw, false)
          ) as never,
          orderBy
        } as never)) as Company[]
    }
  }

  // Static collection - fetch via link tables
  switch (entityType) {
    case 'game': {
      const whereCondition = and(
        eq(schema.collectionGameLinks.collectionId, collectionId),
        showNsfw ? undefined : eq(schema.games.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.collectionGameLinks)
        .innerJoin(schema.games, eq(schema.collectionGameLinks.gameId, schema.games.id))
        .where(whereCondition)
        .orderBy(asc(schema.collectionGameLinks.orderInCollection))

      return rows.map((row) => row.games) as Game[]
    }
    case 'character': {
      const whereCondition = and(
        eq(schema.collectionCharacterLinks.collectionId, collectionId),
        showNsfw ? undefined : eq(schema.characters.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.collectionCharacterLinks)
        .innerJoin(
          schema.characters,
          eq(schema.collectionCharacterLinks.characterId, schema.characters.id)
        )
        .where(whereCondition)
        .orderBy(asc(schema.collectionCharacterLinks.orderInCollection))

      return rows.map((row) => row.characters) as Character[]
    }
    case 'person': {
      const whereCondition = and(
        eq(schema.collectionPersonLinks.collectionId, collectionId),
        showNsfw ? undefined : eq(schema.persons.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.collectionPersonLinks)
        .innerJoin(schema.persons, eq(schema.collectionPersonLinks.personId, schema.persons.id))
        .where(whereCondition)
        .orderBy(asc(schema.collectionPersonLinks.orderInCollection))

      return rows.map((row) => row.persons) as Person[]
    }
    case 'company': {
      const whereCondition = and(
        eq(schema.collectionCompanyLinks.collectionId, collectionId),
        showNsfw ? undefined : eq(schema.companies.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.collectionCompanyLinks)
        .innerJoin(
          schema.companies,
          eq(schema.collectionCompanyLinks.companyId, schema.companies.id)
        )
        .where(whereCondition)
        .orderBy(asc(schema.collectionCompanyLinks.orderInCollection))

      return rows.map((row) => row.companies) as Company[]
    }
  }
}

const getQuerySpec = getFilterQuerySpec

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
  const entityTables = ['games', 'characters', 'persons', 'companies']

  useDbChanges(({ operation, table, id: entityId }) => {
    if (operation === 'updated') {
      if (table === 'collections' && entityId === toValue(collectionId)) {
        refetch()
      }
      // For dynamic collections, refetch when source entities change
      if (isDynamic.value && entityTables.includes(table)) {
        refetch()
      }
    }
    if (operation === 'inserted') {
      if (table === getLinkTableName(context.entityType.value) || table === 'collections') {
        refetch()
      }
      if (isDynamic.value && entityTables.includes(table)) {
        refetch()
      }
    }
    if (operation === 'deleted') {
      if (table === getLinkTableName(context.entityType.value)) {
        refetch()
      }
      if (isDynamic.value && entityTables.includes(table)) {
        refetch()
      }
    }
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
