/**
 * Novel data composable
 *
 * Provides novel data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `novelDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useNovelRouteProvider()`.
 * - Dialog: `useNovelDialogProvider()` fetches on demand after mount.
 */

import {
  provide,
  inject,
  ref,
  toRef,
  toValue,
  computed,
  watch,
  type InjectionKey,
  type Ref,
  type MaybeRefOrGetter,
  type ComputedRef
} from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { eq, asc, desc, and, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import type {
  Novel,
  NovelVolume,
  NovelVolumeFile,
  NovelNote,
  NovelSession,
  NovelCharacterLink,
  NovelPersonLink,
  NovelCompanyLink,
  NovelTagLink,
  Character,
  Person,
  Company,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import { fetchMediaRelations, type MediaRelationEntry } from '@renderer/core/db/media-relations'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

/** One volume with the readable files it owns, ordered by preference. */
export interface NovelVolumeEntry extends NovelVolume {
  files: NovelVolumeFile[]
}

interface NovelData {
  novel: Novel | null
  volumes: NovelVolumeEntry[]
  notes: NovelNote[]
  tags: (NovelTagLink & { tag: Tag | null })[]
  characters: (NovelCharacterLink & { character: Character | null })[]
  persons: (NovelPersonLink & { person: Person | null })[]
  companies: (NovelCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: NovelSession[]
}

export interface NovelContext {
  /** Novel data */
  novel: ComputedRef<Novel | null>
  /** Volumes in display order, each with its readable files */
  volumes: ComputedRef<NovelVolumeEntry[]>
  /** Novel notes (from novelNotes) */
  notes: ComputedRef<NovelNote[]>
  /** Novel tags (from novelTagLinks) */
  tags: ComputedRef<(NovelTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(NovelCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(NovelPersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(NovelCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Novel sessions (reading history) */
  sessions: ComputedRef<NovelSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface NovelProviderReturn extends NovelContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const NovelKey: InjectionKey<NovelContext> = Symbol('novel')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchNovelData(
  novelId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<NovelData | null> {
  if (!novelId) return null

  const novelWhere = and(
    eq(schema.novels.id, novelId),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )
  const [novelData] = await db.select().from(schema.novels).where(novelWhere).limit(1)

  if (!novelData) return null

  const novelTagLinksWhere = and(
    eq(schema.novelTagLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const novelCharacterLinksWhere = and(
    eq(schema.novelCharacterLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const novelPersonLinksWhere = and(
    eq(schema.novelPersonLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const novelCompanyLinksWhere = and(
    eq(schema.novelCompanyLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [volumes, notes, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.novelVolumes)
        .where(eq(schema.novelVolumes.novelId, novelId))
        .orderBy(asc(schema.novelVolumes.orderInNovel), asc(schema.novelVolumes.volumeNumber)),
      db
        .select()
        .from(schema.novelNotes)
        .where(eq(schema.novelNotes.novelId, novelId))
        .orderBy(asc(schema.novelNotes.orderInNovel), asc(schema.novelNotes.name)),
      db
        .select()
        .from(schema.novelTagLinks)
        .leftJoin(schema.tags, eq(schema.novelTagLinks.tagId, schema.tags.id))
        .where(novelTagLinksWhere)
        .orderBy(asc(schema.novelTagLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.novelCharacterLinks.characterId, schema.characters.id)
        )
        .where(novelCharacterLinksWhere)
        .orderBy(asc(schema.novelCharacterLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelPersonLinks)
        .leftJoin(schema.persons, eq(schema.novelPersonLinks.personId, schema.persons.id))
        .where(novelPersonLinksWhere)
        .orderBy(asc(schema.novelPersonLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelCompanyLinks)
        .leftJoin(schema.companies, eq(schema.novelCompanyLinks.companyId, schema.companies.id))
        .where(novelCompanyLinksWhere)
        .orderBy(asc(schema.novelCompanyLinks.orderInNovel)),
      fetchMediaRelations('novel', novelId, showNsfw),
      db
        .select()
        .from(schema.novelSessions)
        .where(eq(schema.novelSessions.novelId, novelId))
        .orderBy(desc(schema.novelSessions.startedAt))
    ])

  return {
    novel: novelData,
    volumes: await attachVolumeFiles(volumes),
    notes,
    tags: tagLinks.map((row) => ({ ...row.novel_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.novel_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.novel_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.novel_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep volume order stable. */
async function attachVolumeFiles(volumes: NovelVolume[]): Promise<NovelVolumeEntry[]> {
  if (volumes.length === 0) return []

  const files = await db
    .select()
    .from(schema.novelVolumeFiles)
    .where(
      inArray(
        schema.novelVolumeFiles.volumeId,
        volumes.map((volume) => volume.id)
      )
    )
    .orderBy(desc(schema.novelVolumeFiles.isPrimary), asc(schema.novelVolumeFiles.createdAt))

  const filesByVolume = new Map<string, NovelVolumeFile[]>()
  for (const file of files) {
    const bucket = filesByVolume.get(file.volumeId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByVolume.set(file.volumeId, [file])
    }
  }

  return volumes.map((volume) => ({ ...volume, files: filesByVolume.get(volume.id) ?? [] }))
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different novel loads.
let lastRouteNovelId: string | null = null
const routeSpoilersRevealed = ref(false)

export const novelDetailData = defineRouteData((route) => {
  const novelId = route.params.novelId as string
  if (novelId !== lastRouteNovelId) {
    lastRouteNovelId = novelId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchNovelData(novelId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface NovelDataSource {
  data: Readonly<Ref<NovelData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideNovelContext(source: NovelDataSource): NovelContext {
  const context: NovelContext = {
    novel: computed(() => source.data.value?.novel ?? null),
    volumes: computed(() => source.data.value?.volumes ?? []),
    notes: computed(() => source.data.value?.notes ?? []),
    tags: computed(() => source.data.value?.tags ?? []),
    characters: computed(() => source.data.value?.characters ?? []),
    persons: computed(() => source.data.value?.persons ?? []),
    companies: computed(() => source.data.value?.companies ?? []),
    relations: computed(() => source.data.value?.relations ?? []),
    sessions: computed(() => source.data.value?.sessions ?? []),
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(NovelKey, context)

  return context
}

const NOVEL_OWNED_TABLES = [
  'novel_volumes',
  'novel_volume_files',
  'novel_notes',
  'novel_sessions',
  'novel_tag_links',
  'novel_character_links',
  'novel_person_links',
  'novel_company_links',
  'media_relations'
]

function useNovelDbSync(novelId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (NOVEL_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'novels' && entityId === toValue(novelId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide novel data on the route surface.
 *
 * Data is loaded by `novelDetailData` during navigation, so it is already
 * settled when the page mounts. In-page input changes (spoilers, NSFW
 * preference) trigger a non-blocking SWR refetch.
 */
export function useNovelRouteProvider(): NovelProviderReturn {
  const route = useRoute()
  const novelId = computed(() => route.params.novelId as string)
  const { data, error, isFetching, refetch } = novelDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  // Explicit setter (not a watcher on the module ref) so the loader's
  // cross-navigation spoiler reset does not trigger a duplicate fetch.
  const spoilersRevealed = computed({
    get: () => routeSpoilersRevealed.value,
    set: (value) => {
      routeSpoilersRevealed.value = value
      void refetch()
    }
  })

  const context = provideNovelContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useNovelDbSync(novelId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide novel data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useNovelDialogProvider(novelId: MaybeRefOrGetter<string>): NovelProviderReturn {
  const id = toRef(novelId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchNovelData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideNovelContext({ data, isLoading, isFetching, error, refetch })
  useNovelDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume novel data context
 *
 * Call this in child components to access novel data.
 */
export function useNovel(): NovelContext {
  const context = inject(NovelKey)
  if (!context) {
    throw new Error('useNovel() must be used within a component that provided the novel context')
  }
  return context
}
