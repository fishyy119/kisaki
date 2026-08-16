/**
 * Movie data composable
 *
 * Provides movie data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `movieDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useMovieRouteProvider()`.
 * - Dialog: `useMovieDialogProvider()` fetches on demand after mount.
 *
 * A film has one consumption unit, so there is no episode grain: the releases
 * of the feature are file rows on the entry itself.
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
  Movie,
  MovieFile,
  MovieExtra,
  MovieExtraFile,
  MovieNote,
  MovieSession,
  MovieCharacterLink,
  MoviePersonLink,
  MovieCompanyLink,
  MovieTagLink,
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

/** One extra with the playable files it owns, ordered by preference. */
export interface MovieExtraEntry extends MovieExtra {
  files: MovieExtraFile[]
}

interface MovieData {
  movie: Movie | null
  files: MovieFile[]
  extras: MovieExtraEntry[]
  notes: MovieNote[]
  tags: (MovieTagLink & { tag: Tag | null })[]
  characters: (MovieCharacterLink & { character: Character | null })[]
  persons: (MoviePersonLink & { person: Person | null })[]
  companies: (MovieCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: MovieSession[]
}

export interface MovieContext {
  /** Movie data */
  movie: ComputedRef<Movie | null>
  /** Playable releases of the feature, preferred file first */
  files: ComputedRef<MovieFile[]>
  /** Supplementary assets (trailers, deleted scenes), each with its files */
  extras: ComputedRef<MovieExtraEntry[]>
  /** Movie notes (from movieNotes) */
  notes: ComputedRef<MovieNote[]>
  /** Movie tags (from movieTagLinks) */
  tags: ComputedRef<(MovieTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(MovieCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(MoviePersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(MovieCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Movie sessions (watch history) */
  sessions: ComputedRef<MovieSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface MovieProviderReturn extends MovieContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const MovieKey: InjectionKey<MovieContext> = Symbol('movie')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchMovieData(
  movieId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<MovieData | null> {
  if (!movieId) return null

  const movieWhere = and(
    eq(schema.movies.id, movieId),
    showNsfw ? undefined : eq(schema.movies.isNsfw, false)
  )
  const [movieData] = await db.select().from(schema.movies).where(movieWhere).limit(1)

  if (!movieData) return null

  const movieTagLinksWhere = and(
    eq(schema.movieTagLinks.movieId, movieId),
    spoilersRevealed ? undefined : eq(schema.movieTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const movieCharacterLinksWhere = and(
    eq(schema.movieCharacterLinks.movieId, movieId),
    spoilersRevealed ? undefined : eq(schema.movieCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const moviePersonLinksWhere = and(
    eq(schema.moviePersonLinks.movieId, movieId),
    spoilersRevealed ? undefined : eq(schema.moviePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const movieCompanyLinksWhere = and(
    eq(schema.movieCompanyLinks.movieId, movieId),
    spoilersRevealed ? undefined : eq(schema.movieCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [
    files,
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
      .from(schema.movieFiles)
      .where(eq(schema.movieFiles.movieId, movieId))
      .orderBy(desc(schema.movieFiles.isPrimary), asc(schema.movieFiles.createdAt)),
    db
      .select()
      .from(schema.movieExtras)
      .where(eq(schema.movieExtras.movieId, movieId))
      .orderBy(asc(schema.movieExtras.orderInMovie), asc(schema.movieExtras.name)),
    db
      .select()
      .from(schema.movieNotes)
      .where(eq(schema.movieNotes.movieId, movieId))
      .orderBy(asc(schema.movieNotes.orderInMovie), asc(schema.movieNotes.name)),
    db
      .select()
      .from(schema.movieTagLinks)
      .leftJoin(schema.tags, eq(schema.movieTagLinks.tagId, schema.tags.id))
      .where(movieTagLinksWhere)
      .orderBy(asc(schema.movieTagLinks.orderInMovie)),
    db
      .select()
      .from(schema.movieCharacterLinks)
      .leftJoin(schema.characters, eq(schema.movieCharacterLinks.characterId, schema.characters.id))
      .where(movieCharacterLinksWhere)
      .orderBy(asc(schema.movieCharacterLinks.orderInMovie)),
    db
      .select()
      .from(schema.moviePersonLinks)
      .leftJoin(schema.persons, eq(schema.moviePersonLinks.personId, schema.persons.id))
      .where(moviePersonLinksWhere)
      .orderBy(asc(schema.moviePersonLinks.orderInMovie)),
    db
      .select()
      .from(schema.movieCompanyLinks)
      .leftJoin(schema.companies, eq(schema.movieCompanyLinks.companyId, schema.companies.id))
      .where(movieCompanyLinksWhere)
      .orderBy(asc(schema.movieCompanyLinks.orderInMovie)),
    fetchMediaRelations('movie', movieId, showNsfw),
    db
      .select()
      .from(schema.movieSessions)
      .where(eq(schema.movieSessions.movieId, movieId))
      .orderBy(desc(schema.movieSessions.startedAt))
  ])

  return {
    movie: movieData,
    files,
    extras: await attachExtraFiles(extras),
    notes,
    tags: tagLinks.map((row) => ({ ...row.movie_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.movie_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.movie_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.movie_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Extra files load in one query, primary first, mirroring the release list. */
async function attachExtraFiles(extras: MovieExtra[]): Promise<MovieExtraEntry[]> {
  if (extras.length === 0) return []

  const files = await db
    .select()
    .from(schema.movieExtraFiles)
    .where(
      inArray(
        schema.movieExtraFiles.extraId,
        extras.map((extra) => extra.id)
      )
    )
    .orderBy(desc(schema.movieExtraFiles.isPrimary), asc(schema.movieExtraFiles.createdAt))

  const filesByExtra = new Map<string, MovieExtraFile[]>()
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
// fetch reads a consistent value; it resets whenever a different movie loads.
let lastRouteMovieId: string | null = null
const routeSpoilersRevealed = ref(false)

export const movieDetailData = defineRouteData((route) => {
  const movieId = route.params.movieId as string
  if (movieId !== lastRouteMovieId) {
    lastRouteMovieId = movieId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchMovieData(movieId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface MovieDataSource {
  data: Readonly<Ref<MovieData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideMovieContext(source: MovieDataSource): MovieContext {
  const context: MovieContext = {
    movie: computed(() => source.data.value?.movie ?? null),
    files: computed(() => source.data.value?.files ?? []),
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

  provide(MovieKey, context)

  return context
}

const MOVIE_OWNED_TABLES = [
  'movie_files',
  'movie_extras',
  'movie_extra_files',
  'movie_notes',
  'movie_sessions',
  'movie_tag_links',
  'movie_character_links',
  'movie_person_links',
  'movie_company_links',
  'media_relations'
]

function useMovieDbSync(movieId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (MOVIE_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'movies' && entityId === toValue(movieId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide movie data on the route surface.
 *
 * Data is loaded by `movieDetailData` during navigation, so it is already
 * settled when the page mounts. In-page input changes (spoilers, NSFW
 * preference) trigger a non-blocking SWR refetch.
 */
export function useMovieRouteProvider(): MovieProviderReturn {
  const route = useRoute()
  const movieId = computed(() => route.params.movieId as string)
  const { data, error, isFetching, refetch } = movieDetailData()

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

  const context = provideMovieContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useMovieDbSync(movieId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide movie data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useMovieDialogProvider(movieId: MaybeRefOrGetter<string>): MovieProviderReturn {
  const id = toRef(movieId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchMovieData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideMovieContext({ data, isLoading, isFetching, error, refetch })
  useMovieDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume movie data context
 *
 * Call this in child components to access movie data.
 */
export function useMovie(): MovieContext {
  const context = inject(MovieKey)
  if (!context) {
    throw new Error('useMovie() must be used within a component that provided the movie context')
  }
  return context
}
