/**
 * Tv data composable
 *
 * Provides series data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `tvDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useTvRouteProvider()`.
 * - Dialog: `useTvDialogProvider()` fetches on demand after mount.
 *
 * Episodes arrive both flat (entry order) and grouped by season, because the
 * season is the show's own display grain while entry-wide mechanics (next
 * episode, progress) read the flat list.
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
  Tv,
  TvSeason,
  TvEpisode,
  TvEpisodeFile,
  TvExtra,
  TvExtraFile,
  TvNote,
  TvSession,
  TvCharacterLink,
  TvPersonLink,
  TvCompanyLink,
  TvTagLink,
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
export interface TvEpisodeEntry extends TvEpisode {
  files: TvEpisodeFile[]
}

/** One season with the episodes it holds, in season order. */
export interface TvSeasonEntry extends TvSeason {
  episodes: TvEpisodeEntry[]
}

/** One extra with the playable files it owns, ordered by preference. */
export interface TvExtraEntry extends TvExtra {
  files: TvExtraFile[]
}

interface TvData {
  tv: Tv | null
  seasons: TvSeasonEntry[]
  episodes: TvEpisodeEntry[]
  extras: TvExtraEntry[]
  notes: TvNote[]
  tags: (TvTagLink & { tag: Tag | null })[]
  characters: (TvCharacterLink & { character: Character | null })[]
  persons: (TvPersonLink & { person: Person | null })[]
  companies: (TvCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: TvSession[]
}

export interface TvContext {
  /** Series data */
  tv: ComputedRef<Tv | null>
  /** Seasons in display order, each with its episodes */
  seasons: ComputedRef<TvSeasonEntry[]>
  /** Every episode of the entry in entry order, each with its playable files */
  episodes: ComputedRef<TvEpisodeEntry[]>
  /** Supplementary assets (trailers, behind-the-scenes), each with its files */
  extras: ComputedRef<TvExtraEntry[]>
  /** Series notes (from tvNotes) */
  notes: ComputedRef<TvNote[]>
  /** Series tags (from tvTagLinks) */
  tags: ComputedRef<(TvTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(TvCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(TvPersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(TvCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Series sessions (watch history) */
  sessions: ComputedRef<TvSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface TvProviderReturn extends TvContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const TvKey: InjectionKey<TvContext> = Symbol('tv')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchTvData(
  tvId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<TvData | null> {
  if (!tvId) return null

  const tvWhere = and(eq(schema.tvs.id, tvId), showNsfw ? undefined : eq(schema.tvs.isNsfw, false))
  const [tvData] = await db.select().from(schema.tvs).where(tvWhere).limit(1)

  if (!tvData) return null

  const tvTagLinksWhere = and(
    eq(schema.tvTagLinks.tvId, tvId),
    spoilersRevealed ? undefined : eq(schema.tvTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const tvCharacterLinksWhere = and(
    eq(schema.tvCharacterLinks.tvId, tvId),
    spoilersRevealed ? undefined : eq(schema.tvCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const tvPersonLinksWhere = and(
    eq(schema.tvPersonLinks.tvId, tvId),
    spoilersRevealed ? undefined : eq(schema.tvPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const tvCompanyLinksWhere = and(
    eq(schema.tvCompanyLinks.tvId, tvId),
    spoilersRevealed ? undefined : eq(schema.tvCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [
    seasons,
    episodes,
    extras,
    notes,
    tagLinks,
    charLinks,
    personLinks,
    companyLinks,
    relations,
    sessions
  ] = await Promise.all([
    db
      .select()
      .from(schema.tvSeasons)
      .where(eq(schema.tvSeasons.tvId, tvId))
      .orderBy(asc(schema.tvSeasons.orderInTv), asc(schema.tvSeasons.seasonNumber)),
    db
      .select()
      .from(schema.tvEpisodes)
      .where(eq(schema.tvEpisodes.tvId, tvId))
      .orderBy(asc(schema.tvEpisodes.orderInTv), asc(schema.tvEpisodes.episodeNumber)),
    db
      .select()
      .from(schema.tvExtras)
      .where(eq(schema.tvExtras.tvId, tvId))
      .orderBy(asc(schema.tvExtras.orderInTv), asc(schema.tvExtras.name)),
    db
      .select()
      .from(schema.tvNotes)
      .where(eq(schema.tvNotes.tvId, tvId))
      .orderBy(asc(schema.tvNotes.orderInTv), asc(schema.tvNotes.name)),
    db
      .select()
      .from(schema.tvTagLinks)
      .leftJoin(schema.tags, eq(schema.tvTagLinks.tagId, schema.tags.id))
      .where(tvTagLinksWhere)
      .orderBy(asc(schema.tvTagLinks.orderInTv)),
    db
      .select()
      .from(schema.tvCharacterLinks)
      .leftJoin(schema.characters, eq(schema.tvCharacterLinks.characterId, schema.characters.id))
      .where(tvCharacterLinksWhere)
      .orderBy(asc(schema.tvCharacterLinks.orderInTv)),
    db
      .select()
      .from(schema.tvPersonLinks)
      .leftJoin(schema.persons, eq(schema.tvPersonLinks.personId, schema.persons.id))
      .where(tvPersonLinksWhere)
      .orderBy(asc(schema.tvPersonLinks.orderInTv)),
    db
      .select()
      .from(schema.tvCompanyLinks)
      .leftJoin(schema.companies, eq(schema.tvCompanyLinks.companyId, schema.companies.id))
      .where(tvCompanyLinksWhere)
      .orderBy(asc(schema.tvCompanyLinks.orderInTv)),
    fetchMediaRelations('tv', tvId, showNsfw),
    db
      .select()
      .from(schema.tvSessions)
      .where(eq(schema.tvSessions.tvId, tvId))
      .orderBy(desc(schema.tvSessions.startedAt))
  ])

  const episodeEntries = await attachEpisodeFiles(episodes)

  return {
    tv: tvData,
    seasons: groupEpisodesBySeason(seasons, episodeEntries),
    episodes: episodeEntries,
    extras: await attachExtraFiles(extras),
    notes,
    tags: tagLinks.map((row) => ({ ...row.tv_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.tv_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.tv_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.tv_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Episodes group under their season in season order, keeping episode order. */
function groupEpisodesBySeason(seasons: TvSeason[], episodes: TvEpisodeEntry[]): TvSeasonEntry[] {
  const bySeason = new Map<string, TvEpisodeEntry[]>()
  for (const episode of episodes) {
    const bucket = bySeason.get(episode.seasonId)
    if (bucket) {
      bucket.push(episode)
    } else {
      bySeason.set(episode.seasonId, [episode])
    }
  }

  return seasons.map((season) => ({
    ...season,
    episodes: (bySeason.get(season.id) ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.orderInSeason - b.orderInSeason || (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)
      )
  }))
}

/** Files are loaded in one query and grouped in memory to keep episode order stable. */
async function attachEpisodeFiles(episodes: TvEpisode[]): Promise<TvEpisodeEntry[]> {
  if (episodes.length === 0) return []

  const files = await db
    .select()
    .from(schema.tvEpisodeFiles)
    .where(
      inArray(
        schema.tvEpisodeFiles.episodeId,
        episodes.map((episode) => episode.id)
      )
    )
    .orderBy(desc(schema.tvEpisodeFiles.isPrimary), asc(schema.tvEpisodeFiles.createdAt))

  const filesByEpisode = new Map<string, TvEpisodeFile[]>()
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
async function attachExtraFiles(extras: TvExtra[]): Promise<TvExtraEntry[]> {
  if (extras.length === 0) return []

  const files = await db
    .select()
    .from(schema.tvExtraFiles)
    .where(
      inArray(
        schema.tvExtraFiles.extraId,
        extras.map((extra) => extra.id)
      )
    )
    .orderBy(desc(schema.tvExtraFiles.isPrimary), asc(schema.tvExtraFiles.createdAt))

  const filesByExtra = new Map<string, TvExtraFile[]>()
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
// fetch reads a consistent value; it resets whenever a different show loads.
let lastRouteTvId: string | null = null
const routeSpoilersRevealed = ref(false)

export const tvDetailData = defineRouteData((route) => {
  const tvId = route.params.tvId as string
  if (tvId !== lastRouteTvId) {
    lastRouteTvId = tvId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchTvData(tvId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface TvDataSource {
  data: Readonly<Ref<TvData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideTvContext(source: TvDataSource): TvContext {
  const context: TvContext = {
    tv: computed(() => source.data.value?.tv ?? null),
    seasons: computed(() => source.data.value?.seasons ?? []),
    episodes: computed(() => source.data.value?.episodes ?? []),
    extras: computed(() => source.data.value?.extras ?? []),
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

  provide(TvKey, context)

  return context
}

const TV_OWNED_TABLES = [
  'tv_seasons',
  'tv_episodes',
  'tv_episode_files',
  'tv_extras',
  'tv_extra_files',
  'tv_notes',
  'tv_sessions',
  'tv_tag_links',
  'tv_character_links',
  'tv_person_links',
  'tv_company_links',
  'media_relations'
]

function useTvDbSync(tvId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (TV_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'tvs' && entityId === toValue(tvId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide series data on the route surface.
 *
 * Data is loaded by `tvDetailData` during navigation, so it is already settled
 * when the page mounts. In-page input changes (spoilers, NSFW preference)
 * trigger a non-blocking SWR refetch.
 */
export function useTvRouteProvider(): TvProviderReturn {
  const route = useRoute()
  const tvId = computed(() => route.params.tvId as string)
  const { data, error, isFetching, refetch } = tvDetailData()

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

  const context = provideTvContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useTvDbSync(tvId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide series data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useTvDialogProvider(tvId: MaybeRefOrGetter<string>): TvProviderReturn {
  const id = toRef(tvId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchTvData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideTvContext({ data, isLoading, isFetching, error, refetch })
  useTvDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume series data context
 *
 * Call this in child components to access series data.
 */
export function useTv(): TvContext {
  const context = inject(TvKey)
  if (!context) {
    throw new Error('useTv() must be used within a component that provided the tv context')
  }
  return context
}
