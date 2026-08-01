/**
 * Tag data composable
 *
 * Provides tag data with related entities using Provider/Consumer pattern.
 * Supports all entity types (game, character, person, company).
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
import { eq, asc, count, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import type { Tag, Game, Character, Person, Company } from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { ContentEntityType } from '@shared/common'
import type { ContentEntityData, ContentEntityCounts } from './types'
import { useDbChanges } from './use-db-changes'

interface TagData {
  tag: Tag | null
  counts: ContentEntityCounts
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

export interface TagContext {
  /** Tag data */
  tag: ComputedRef<Tag | null>
  /** Entities with this tag for current entity type */
  entities: ComputedRef<ContentEntityData[]>
  /** Current entity type being viewed */
  entityType: ComputedRef<ContentEntityType>
  /** Entity counts for all types */
  entityCounts: ComputedRef<ContentEntityCounts>
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

export const TagKey: InjectionKey<TagContext> = Symbol('tag')

// =============================================================================
// Helper Functions
// =============================================================================

function getLinkTableName(type: ContentEntityType): string {
  switch (type) {
    case 'game':
      return 'gameTagLinks'
    case 'character':
      return 'characterTagLinks'
    case 'person':
      return 'personTagLinks'
    case 'company':
      return 'companyTagLinks'
  }
}

function getDefaultEntityType(counts: ContentEntityCounts): ContentEntityType {
  const entries = Object.entries(counts) as [ContentEntityType, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted[0][1] > 0 ? sorted[0][0] : 'game'
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

async function fetchTagWithCounts(
  tagId: string,
  showNsfw: boolean
): Promise<{ tag: Tag | null; counts: ContentEntityCounts }> {
  const tagWhere = and(
    eq(schema.tags.id, tagId),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const [[tagData], [gameCountRow], [characterCountRow], [personCountRow], [companyCountRow]] =
    await Promise.all([
      db
        .select()
        .from(schema.tags)
        .where(tagWhere as never)
        .limit(1),
      db
        .select({ value: count() })
        .from(schema.gameTagLinks)
        .innerJoin(schema.games, eq(schema.gameTagLinks.gameId, schema.games.id))
        .where(
          and(
            eq(schema.gameTagLinks.tagId, tagId),
            showNsfw ? undefined : eq(schema.games.isNsfw, false)
          )
        ),
      db
        .select({ value: count() })
        .from(schema.characterTagLinks)
        .innerJoin(
          schema.characters,
          eq(schema.characterTagLinks.characterId, schema.characters.id)
        )
        .where(
          and(
            eq(schema.characterTagLinks.tagId, tagId),
            showNsfw ? undefined : eq(schema.characters.isNsfw, false)
          )
        ),
      db
        .select({ value: count() })
        .from(schema.personTagLinks)
        .innerJoin(schema.persons, eq(schema.personTagLinks.personId, schema.persons.id))
        .where(
          and(
            eq(schema.personTagLinks.tagId, tagId),
            showNsfw ? undefined : eq(schema.persons.isNsfw, false)
          )
        ),
      db
        .select({ value: count() })
        .from(schema.companyTagLinks)
        .innerJoin(schema.companies, eq(schema.companyTagLinks.companyId, schema.companies.id))
        .where(
          and(
            eq(schema.companyTagLinks.tagId, tagId),
            showNsfw ? undefined : eq(schema.companies.isNsfw, false)
          )
        )
    ])

  return {
    tag: tagData ?? null,
    counts: {
      game: Number(gameCountRow?.value ?? 0),
      character: Number(characterCountRow?.value ?? 0),
      person: Number(personCountRow?.value ?? 0),
      company: Number(companyCountRow?.value ?? 0)
    }
  }
}

async function fetchEntitiesByType(
  tagId: string,
  type: ContentEntityType,
  showNsfw: boolean
): Promise<ContentEntityData[]> {
  switch (type) {
    case 'game': {
      const whereCondition = and(
        eq(schema.gameTagLinks.tagId, tagId),
        showNsfw ? undefined : eq(schema.games.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.gameTagLinks)
        .innerJoin(schema.games, eq(schema.gameTagLinks.gameId, schema.games.id))
        .where(whereCondition)
        .orderBy(asc(schema.gameTagLinks.orderInTag))

      return rows.map((row) => row.games) as Game[]
    }
    case 'character': {
      const whereCondition = and(
        eq(schema.characterTagLinks.tagId, tagId),
        showNsfw ? undefined : eq(schema.characters.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.characterTagLinks)
        .innerJoin(
          schema.characters,
          eq(schema.characterTagLinks.characterId, schema.characters.id)
        )
        .where(whereCondition)
        .orderBy(asc(schema.characterTagLinks.orderInTag))

      return rows.map((row) => row.characters) as Character[]
    }
    case 'person': {
      const whereCondition = and(
        eq(schema.personTagLinks.tagId, tagId),
        showNsfw ? undefined : eq(schema.persons.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.personTagLinks)
        .innerJoin(schema.persons, eq(schema.personTagLinks.personId, schema.persons.id))
        .where(whereCondition)
        .orderBy(asc(schema.personTagLinks.orderInTag))

      return rows.map((row) => row.persons) as Person[]
    }
    case 'company': {
      const whereCondition = and(
        eq(schema.companyTagLinks.tagId, tagId),
        showNsfw ? undefined : eq(schema.companies.isNsfw, false)
      )
      const rows = await db
        .select()
        .from(schema.companyTagLinks)
        .innerJoin(schema.companies, eq(schema.companyTagLinks.companyId, schema.companies.id))
        .where(whereCondition)
        .orderBy(asc(schema.companyTagLinks.orderInTag))

      return rows.map((row) => row.companies) as Company[]
    }
  }
}

async function fetchTagData(
  tagId: string,
  selectedType: ContentEntityType | null,
  showNsfw: boolean
): Promise<TagData | null> {
  const { tag, counts } = await fetchTagWithCounts(tagId, showNsfw)
  if (!tag) return null

  const entityType = selectedType ?? getDefaultEntityType(counts)
  const entities = await fetchEntitiesByType(tagId, entityType, showNsfw)

  return { tag, counts, entityType, entities }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface entity type selection lives beside the loader so the
// navigation-time fetch reads a consistent value; it resets whenever a
// different tag loads.
let lastRouteTagId: string | null = null
const routeSelectedType = ref<ContentEntityType | null>(null)

export const tagDetailData = defineRouteData((route) => {
  const tagId = route.params.tagId as string
  if (tagId !== lastRouteTagId) {
    lastRouteTagId = tagId
    routeSelectedType.value = null
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchTagData(tagId, routeSelectedType.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface TagDataSource {
  data: Readonly<Ref<TagData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
  setEntityType: (type: ContentEntityType) => void
}

function provideTagContext(source: TagDataSource): TagContext {
  const context: TagContext = {
    tag: computed(() => source.data.value?.tag ?? null),
    entities: computed(() => source.data.value?.entities ?? []),
    entityType: computed(() => source.data.value?.entityType ?? 'game'),
    entityCounts: computed(
      () => source.data.value?.counts ?? { game: 0, character: 0, person: 0, company: 0 }
    ),
    setEntityType: source.setEntityType,
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(TagKey, context)

  return context
}

function useTagDbSync(
  tagId: MaybeRefOrGetter<string>,
  entityType: ComputedRef<ContentEntityType>,
  refetch: () => Promise<void>
): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (operation === 'updated') {
      if (table === 'tags' && entityId === toValue(tagId)) {
        refetch()
      }
      if (table === getLinkTableName(entityType.value)) {
        refetch()
      }
    }
    if (operation === 'inserted') {
      if (table === getLinkTableName(entityType.value)) {
        refetch()
      }
    }
    if (operation === 'deleted') {
      if (table === getLinkTableName(entityType.value)) {
        refetch()
      }
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide tag data on the route surface (data settled during navigation).
 * Entity type switching triggers a non-blocking SWR refetch.
 */
export function useTagRouteProvider(): TagContext {
  const route = useRoute()
  const tagId = computed(() => route.params.tagId as string)
  const { data, error, isFetching, refetch } = tagDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const setEntityType = (type: ContentEntityType) => {
    routeSelectedType.value = type
    void refetch()
  }

  const context = provideTagContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch,
    setEntityType
  })
  useTagDbSync(tagId, context.entityType, refetch)

  return context
}

/**
 * Provide tag data on the dialog surface (fetches after mount).
 */
export function useTagDialogProvider(tagId: MaybeRefOrGetter<string>): TagContext {
  const id = toRef(tagId)
  const selectedType = ref<ContentEntityType | null>(null)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchTagData(toValue(id), selectedType.value, showNsfw.value),
    { watch: [id, selectedType, showNsfw] }
  )

  const setEntityType = (type: ContentEntityType) => {
    selectedType.value = type
  }

  const context = provideTagContext({ data, isLoading, isFetching, error, refetch, setEntityType })
  useTagDbSync(id, context.entityType, refetch)

  return context
}

// =============================================================================
// Consumer Composable
// =============================================================================

export function useTag(): TagContext {
  const context = inject(TagKey)
  if (!context) {
    throw new Error('useTag() must be used within a component that provided the tag context')
  }
  return context
}
