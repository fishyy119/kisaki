/**
 * Anime data composable
 *
 * Provides anime data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `animeDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useAnimeRouteProvider()`.
 * - Dialog: `useAnimeDialogProvider()` fetches on demand after mount.
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
  Anime,
  AnimeEpisode,
  AnimeEpisodeFile,
  AnimeExtra,
  AnimeExtraFile,
  AnimeSession,
  AnimeCharacterLink,
  AnimePersonLink,
  AnimeCompanyLink,
  AnimeTagLink,
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

/** One episode with the playable files it owns, ordered by preference. */
export interface AnimeEpisodeEntry extends AnimeEpisode {
  files: AnimeEpisodeFile[]
}

/** One extra with the playable files it owns, ordered by preference. */
export interface AnimeExtraEntry extends AnimeExtra {
  files: AnimeExtraFile[]
}

interface AnimeData {
  anime: Anime | null
  episodes: AnimeEpisodeEntry[]
  extras: AnimeExtraEntry[]
  tags: (AnimeTagLink & { tag: Tag | null })[]
  characters: (AnimeCharacterLink & { character: Character | null })[]
  persons: (AnimePersonLink & { person: Person | null })[]
  companies: (AnimeCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: AnimeSession[]
}

export interface AnimeContext {
  /** Anime data */
  anime: ComputedRef<Anime | null>
  /** Episodes in display order, each with its playable files */
  episodes: ComputedRef<AnimeEpisodeEntry[]>
  /** Supplementary assets (trailers, creditless openings), each with its files */
  extras: ComputedRef<AnimeExtraEntry[]>
  /** Anime tags (from animeTagLinks) */
  tags: ComputedRef<(AnimeTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(AnimeCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(AnimePersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(AnimeCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Anime sessions (watch history) */
  sessions: ComputedRef<AnimeSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface AnimeProviderReturn extends AnimeContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const AnimeKey: InjectionKey<AnimeContext> = Symbol('anime')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchAnimeData(
  animeId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<AnimeData | null> {
  if (!animeId) return null

  const animeWhere = and(
    eq(schema.animes.id, animeId),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )
  const [animeData] = await db.select().from(schema.animes).where(animeWhere).limit(1)

  if (!animeData) return null

  const animeTagLinksWhere = and(
    eq(schema.animeTagLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const animeCharacterLinksWhere = and(
    eq(schema.animeCharacterLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const animePersonLinksWhere = and(
    eq(schema.animePersonLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const animeCompanyLinksWhere = and(
    eq(schema.animeCompanyLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [episodes, extras, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.animeEpisodes)
        .where(eq(schema.animeEpisodes.animeId, animeId))
        .orderBy(asc(schema.animeEpisodes.orderInAnime), asc(schema.animeEpisodes.episodeNumber)),
      db
        .select()
        .from(schema.animeExtras)
        .where(eq(schema.animeExtras.animeId, animeId))
        .orderBy(asc(schema.animeExtras.orderInAnime), asc(schema.animeExtras.name)),
      db
        .select()
        .from(schema.animeTagLinks)
        .leftJoin(schema.tags, eq(schema.animeTagLinks.tagId, schema.tags.id))
        .where(animeTagLinksWhere)
        .orderBy(asc(schema.animeTagLinks.orderInAnime)),
      db
        .select()
        .from(schema.animeCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.animeCharacterLinks.characterId, schema.characters.id)
        )
        .where(animeCharacterLinksWhere)
        .orderBy(asc(schema.animeCharacterLinks.orderInAnime)),
      db
        .select()
        .from(schema.animePersonLinks)
        .leftJoin(schema.persons, eq(schema.animePersonLinks.personId, schema.persons.id))
        .where(animePersonLinksWhere)
        .orderBy(asc(schema.animePersonLinks.orderInAnime)),
      db
        .select()
        .from(schema.animeCompanyLinks)
        .leftJoin(schema.companies, eq(schema.animeCompanyLinks.companyId, schema.companies.id))
        .where(animeCompanyLinksWhere)
        .orderBy(asc(schema.animeCompanyLinks.orderInAnime)),
      fetchMediaRelations('anime', animeId, showNsfw),
      db
        .select()
        .from(schema.animeSessions)
        .where(eq(schema.animeSessions.animeId, animeId))
        .orderBy(desc(schema.animeSessions.startedAt))
    ])

  return {
    anime: animeData,
    episodes: await attachEpisodeFiles(episodes),
    extras: await attachExtraFiles(extras),
    tags: tagLinks.map((row) => ({ ...row.anime_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.anime_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.anime_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.anime_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep episode order stable. */
async function attachEpisodeFiles(episodes: AnimeEpisode[]): Promise<AnimeEpisodeEntry[]> {
  if (episodes.length === 0) return []

  const files = await db
    .select()
    .from(schema.animeEpisodeFiles)
    .where(
      inArray(
        schema.animeEpisodeFiles.episodeId,
        episodes.map((episode) => episode.id)
      )
    )
    .orderBy(desc(schema.animeEpisodeFiles.isPrimary), asc(schema.animeEpisodeFiles.createdAt))

  const filesByEpisode = new Map<string, AnimeEpisodeFile[]>()
  for (const file of files) {
    const bucket = filesByEpisode.get(file.episodeId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByEpisode.set(file.episodeId, [file])
    }
  }

  return episodes.map((episode) => ({ ...episode, files: filesByEpisode.get(episode.id) ?? [] }))
}

/** Extra files load in one query, primary first, mirroring the episode files. */
async function attachExtraFiles(extras: AnimeExtra[]): Promise<AnimeExtraEntry[]> {
  if (extras.length === 0) return []

  const files = await db
    .select()
    .from(schema.animeExtraFiles)
    .where(
      inArray(
        schema.animeExtraFiles.extraId,
        extras.map((extra) => extra.id)
      )
    )
    .orderBy(desc(schema.animeExtraFiles.isPrimary), asc(schema.animeExtraFiles.createdAt))

  const filesByExtra = new Map<string, AnimeExtraFile[]>()
  for (const file of files) {
    const bucket = filesByExtra.get(file.extraId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByExtra.set(file.extraId, [file])
    }
  }

  return extras.map((extra) => ({ ...extra, files: filesByExtra.get(extra.id) ?? [] }))
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different anime loads.
let lastRouteAnimeId: string | null = null
const routeSpoilersRevealed = ref(false)

export const animeDetailData = defineRouteData((route) => {
  const animeId = route.params.animeId as string
  if (animeId !== lastRouteAnimeId) {
    lastRouteAnimeId = animeId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchAnimeData(animeId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface AnimeDataSource {
  data: Readonly<Ref<AnimeData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideAnimeContext(source: AnimeDataSource): AnimeContext {
  const context: AnimeContext = {
    anime: computed(() => source.data.value?.anime ?? null),
    episodes: computed(() => source.data.value?.episodes ?? []),
    extras: computed(() => source.data.value?.extras ?? []),
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

  provide(AnimeKey, context)

  return context
}

const ANIME_OWNED_TABLES = [
  'anime_episodes',
  'anime_episode_files',
  'anime_extras',
  'anime_extra_files',
  'anime_sessions',
  'anime_tag_links',
  'anime_character_links',
  'anime_person_links',
  'anime_company_links',
  'media_relations'
]

function useAnimeDbSync(animeId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (ANIME_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'animes' && entityId === toValue(animeId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide anime data on the route surface.
 *
 * Data is loaded by `animeDetailData` during navigation, so it is already
 * settled when the page mounts. In-page input changes (spoilers, NSFW
 * preference) trigger a non-blocking SWR refetch.
 */
export function useAnimeRouteProvider(): AnimeProviderReturn {
  const route = useRoute()
  const animeId = computed(() => route.params.animeId as string)
  const { data, error, isFetching, refetch } = animeDetailData()

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

  const context = provideAnimeContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useAnimeDbSync(animeId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide anime data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useAnimeDialogProvider(animeId: MaybeRefOrGetter<string>): AnimeProviderReturn {
  const id = toRef(animeId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchAnimeData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideAnimeContext({ data, isLoading, isFetching, error, refetch })
  useAnimeDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume anime data context
 *
 * Call this in child components to access anime data.
 */
export function useAnime(): AnimeContext {
  const context = inject(AnimeKey)
  if (!context) {
    throw new Error('useAnime() must be used within a component that provided the anime context')
  }
  return context
}
