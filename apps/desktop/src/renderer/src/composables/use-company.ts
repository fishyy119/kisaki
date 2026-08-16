/**
 * Company data composable
 *
 * Provides company data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * route pages consume the navigation-time loader, dialogs fetch after mount.
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
import { eq, asc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import type {
  Company,
  GameCompanyLink,
  AnimeCompanyLink,
  TvCompanyLink,
  MovieCompanyLink,
  CompanyTagLink,
  Game,
  Anime,
  Tv,
  Movie,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

interface CompanyData {
  company: Company
  tags: (CompanyTagLink & { tag: Tag | null })[]
  games: (GameCompanyLink & { game: Game | null })[]
  animes: (AnimeCompanyLink & { anime: Anime | null })[]
  tvs: (TvCompanyLink & { tv: Tv | null })[]
  movies: (MovieCompanyLink & { movie: Movie | null })[]
}

export interface CompanyContext {
  company: ComputedRef<Company | null>
  tags: ComputedRef<(CompanyTagLink & { tag: Tag | null })[]>
  games: ComputedRef<(GameCompanyLink & { game: Game | null })[]>
  animes: ComputedRef<(AnimeCompanyLink & { anime: Anime | null })[]>
  tvs: ComputedRef<(TvCompanyLink & { tv: Tv | null })[]>
  movies: ComputedRef<(MovieCompanyLink & { movie: Movie | null })[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

export interface CompanyProviderReturn extends CompanyContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const CompanyKey: InjectionKey<CompanyContext> = Symbol('company')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchCompanyData(
  companyId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<CompanyData | null> {
  if (!companyId) return null

  const companyWhere = and(
    eq(schema.companies.id, companyId),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )
  const [companyData] = await db.select().from(schema.companies).where(companyWhere).limit(1)

  if (!companyData) return null

  const companyTagLinksWhere = and(
    eq(schema.companyTagLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.companyTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCompanyLinksWhere = and(
    eq(schema.gameCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.gameCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animeCompanyLinksWhere = and(
    eq(schema.animeCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.animeCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const tvCompanyLinksWhere = and(
    eq(schema.tvCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.tvCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tvs.isNsfw, false)
  )

  const movieCompanyLinksWhere = and(
    eq(schema.movieCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.movieCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.movies.isNsfw, false)
  )

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, tvLinks, movieLinks] = await Promise.all([
    db
      .select()
      .from(schema.companyTagLinks)
      .leftJoin(schema.tags, eq(schema.companyTagLinks.tagId, schema.tags.id))
      .where(companyTagLinksWhere)
      .orderBy(asc(schema.companyTagLinks.orderInCompany)),
    db
      .select()
      .from(schema.gameCompanyLinks)
      .leftJoin(schema.games, eq(schema.gameCompanyLinks.gameId, schema.games.id))
      .where(gameCompanyLinksWhere)
      .orderBy(asc(schema.gameCompanyLinks.orderInCompany)),
    db
      .select()
      .from(schema.animeCompanyLinks)
      .leftJoin(schema.animes, eq(schema.animeCompanyLinks.animeId, schema.animes.id))
      .where(animeCompanyLinksWhere)
      .orderBy(asc(schema.animeCompanyLinks.orderInCompany)),
    db
      .select()
      .from(schema.tvCompanyLinks)
      .leftJoin(schema.tvs, eq(schema.tvCompanyLinks.tvId, schema.tvs.id))
      .where(tvCompanyLinksWhere)
      .orderBy(asc(schema.tvCompanyLinks.orderInCompany)),
    db
      .select()
      .from(schema.movieCompanyLinks)
      .leftJoin(schema.movies, eq(schema.movieCompanyLinks.movieId, schema.movies.id))
      .where(movieCompanyLinksWhere)
      .orderBy(asc(schema.movieCompanyLinks.orderInCompany))
  ])

  return {
    company: companyData,
    tags: tagLinks.map((row) => ({ ...row.company_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_company_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_company_links, anime: row.animes })),
    tvs: tvLinks.map((row) => ({ ...row.tv_company_links, tv: row.tvs })),
    movies: movieLinks.map((row) => ({ ...row.movie_company_links, movie: row.movies }))
  }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different entity loads.
let lastRouteCompanyId: string | null = null
const routeSpoilersRevealed = ref(false)

export const companyDetailData = defineRouteData((route) => {
  const companyId = route.params.companyId as string
  if (companyId !== lastRouteCompanyId) {
    lastRouteCompanyId = companyId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchCompanyData(companyId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface CompanyDataSource {
  data: Readonly<Ref<CompanyData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideCompanyContext(source: CompanyDataSource): CompanyContext {
  const context: CompanyContext = {
    company: computed(() => source.data.value?.company ?? null),
    tags: computed(() => source.data.value?.tags ?? []),
    games: computed(() => source.data.value?.games ?? []),
    animes: computed(() => source.data.value?.animes ?? []),
    tvs: computed(() => source.data.value?.tvs ?? []),
    movies: computed(() => source.data.value?.movies ?? []),
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(CompanyKey, context)

  return context
}

const COMPANY_LINK_TABLES: readonly TableName[] = [
  'company_tag_links',
  'game_company_links',
  'anime_company_links',
  'tv_company_links',
  'movie_company_links'
]

function useCompanyDbSync(companyId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (COMPANY_LINK_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'companies' && entityId === toValue(companyId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide company data on the route surface (data settled during navigation).
 */
export function useCompanyRouteProvider(): CompanyProviderReturn {
  const route = useRoute()
  const companyId = computed(() => route.params.companyId as string)
  const { data, error, isFetching, refetch } = companyDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const spoilersRevealed = computed({
    get: () => routeSpoilersRevealed.value,
    set: (value) => {
      routeSpoilersRevealed.value = value
      void refetch()
    }
  })

  const context = provideCompanyContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useCompanyDbSync(companyId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide company data on the dialog surface (fetches after mount).
 */
export function useCompanyDialogProvider(
  companyId: MaybeRefOrGetter<string>
): CompanyProviderReturn {
  const id = toRef(companyId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchCompanyData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideCompanyContext({ data, isLoading, isFetching, error, refetch })
  useCompanyDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

export function useCompany(): CompanyContext {
  const context = inject(CompanyKey)
  if (!context) {
    throw new Error(
      'useCompany() must be used within a component that provided the company context'
    )
  }
  return context
}
