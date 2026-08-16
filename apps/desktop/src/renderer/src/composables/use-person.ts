/**
 * Person data composable
 *
 * Provides person data with all related entities using Provider/Consumer pattern.
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
  Person,
  GamePersonLink,
  AnimePersonLink,
  TvPersonLink,
  MoviePersonLink,
  CharacterPersonLink,
  PersonTagLink,
  Game,
  Anime,
  Tv,
  Movie,
  Character,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

interface PersonData {
  person: Person
  tags: (PersonTagLink & { tag: Tag | null })[]
  games: (GamePersonLink & { game: Game | null })[]
  animes: (AnimePersonLink & { anime: Anime | null })[]
  tvs: (TvPersonLink & { tv: Tv | null })[]
  movies: (MoviePersonLink & { movie: Movie | null })[]
  characters: (CharacterPersonLink & { character: Character | null })[]
}

export interface PersonContext {
  person: ComputedRef<Person | null>
  tags: ComputedRef<(PersonTagLink & { tag: Tag | null })[]>
  games: ComputedRef<(GamePersonLink & { game: Game | null })[]>
  animes: ComputedRef<(AnimePersonLink & { anime: Anime | null })[]>
  tvs: ComputedRef<(TvPersonLink & { tv: Tv | null })[]>
  movies: ComputedRef<(MoviePersonLink & { movie: Movie | null })[]>
  characters: ComputedRef<(CharacterPersonLink & { character: Character | null })[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

export interface PersonProviderReturn extends PersonContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const PersonKey: InjectionKey<PersonContext> = Symbol('person')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchPersonData(
  personId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<PersonData | null> {
  if (!personId) return null

  const personWhere = and(
    eq(schema.persons.id, personId),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )
  const [personData] = await db.select().from(schema.persons).where(personWhere).limit(1)

  if (!personData) return null

  const personTagLinksWhere = and(
    eq(schema.personTagLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.personTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gamePersonLinksWhere = and(
    eq(schema.gamePersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.gamePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animePersonLinksWhere = and(
    eq(schema.animePersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.animePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const tvPersonLinksWhere = and(
    eq(schema.tvPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.tvPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tvs.isNsfw, false)
  )

  const moviePersonLinksWhere = and(
    eq(schema.moviePersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.moviePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.movies.isNsfw, false)
  )

  const characterPersonLinksWhere = and(
    eq(schema.characterPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.characterPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, tvLinks, movieLinks, charLinks] = await Promise.all([
    db
      .select()
      .from(schema.personTagLinks)
      .leftJoin(schema.tags, eq(schema.personTagLinks.tagId, schema.tags.id))
      .where(personTagLinksWhere)
      .orderBy(asc(schema.personTagLinks.orderInPerson)),
    db
      .select()
      .from(schema.gamePersonLinks)
      .leftJoin(schema.games, eq(schema.gamePersonLinks.gameId, schema.games.id))
      .where(gamePersonLinksWhere)
      .orderBy(asc(schema.gamePersonLinks.orderInPerson)),
    db
      .select()
      .from(schema.animePersonLinks)
      .leftJoin(schema.animes, eq(schema.animePersonLinks.animeId, schema.animes.id))
      .where(animePersonLinksWhere)
      .orderBy(asc(schema.animePersonLinks.orderInPerson)),
    db
      .select()
      .from(schema.tvPersonLinks)
      .leftJoin(schema.tvs, eq(schema.tvPersonLinks.tvId, schema.tvs.id))
      .where(tvPersonLinksWhere)
      .orderBy(asc(schema.tvPersonLinks.orderInPerson)),
    db
      .select()
      .from(schema.moviePersonLinks)
      .leftJoin(schema.movies, eq(schema.moviePersonLinks.movieId, schema.movies.id))
      .where(moviePersonLinksWhere)
      .orderBy(asc(schema.moviePersonLinks.orderInPerson)),
    db
      .select()
      .from(schema.characterPersonLinks)
      .leftJoin(
        schema.characters,
        eq(schema.characterPersonLinks.characterId, schema.characters.id)
      )
      .where(characterPersonLinksWhere)
      .orderBy(asc(schema.characterPersonLinks.orderInPerson))
  ])

  return {
    person: personData,
    tags: tagLinks.map((row) => ({ ...row.person_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_person_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_person_links, anime: row.animes })),
    tvs: tvLinks.map((row) => ({ ...row.tv_person_links, tv: row.tvs })),
    movies: movieLinks.map((row) => ({ ...row.movie_person_links, movie: row.movies })),
    characters: charLinks.map((row) => ({
      ...row.character_person_links,
      character: row.characters
    }))
  }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different entity loads.
let lastRoutePersonId: string | null = null
const routeSpoilersRevealed = ref(false)

export const personDetailData = defineRouteData((route) => {
  const personId = route.params.personId as string
  if (personId !== lastRoutePersonId) {
    lastRoutePersonId = personId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchPersonData(personId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface PersonDataSource {
  data: Readonly<Ref<PersonData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function providePersonContext(source: PersonDataSource): PersonContext {
  const context: PersonContext = {
    person: computed(() => source.data.value?.person ?? null),
    tags: computed(() => source.data.value?.tags ?? []),
    games: computed(() => source.data.value?.games ?? []),
    animes: computed(() => source.data.value?.animes ?? []),
    tvs: computed(() => source.data.value?.tvs ?? []),
    movies: computed(() => source.data.value?.movies ?? []),
    characters: computed(() => source.data.value?.characters ?? []),
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(PersonKey, context)

  return context
}

const PERSON_LINK_TABLES: readonly TableName[] = [
  'person_tag_links',
  'game_person_links',
  'anime_person_links',
  'tv_person_links',
  'movie_person_links',
  'character_person_links'
]

function usePersonDbSync(personId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (PERSON_LINK_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'persons' && entityId === toValue(personId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide person data on the route surface (data settled during navigation).
 */
export function usePersonRouteProvider(): PersonProviderReturn {
  const route = useRoute()
  const personId = computed(() => route.params.personId as string)
  const { data, error, isFetching, refetch } = personDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const spoilersRevealed = computed({
    get: () => routeSpoilersRevealed.value,
    set: (value) => {
      routeSpoilersRevealed.value = value
      void refetch()
    }
  })

  const context = providePersonContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  usePersonDbSync(personId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide person data on the dialog surface (fetches after mount).
 */
export function usePersonDialogProvider(personId: MaybeRefOrGetter<string>): PersonProviderReturn {
  const id = toRef(personId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchPersonData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = providePersonContext({ data, isLoading, isFetching, error, refetch })
  usePersonDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

export function usePerson(): PersonContext {
  const context = inject(PersonKey)
  if (!context) {
    throw new Error('usePerson() must be used within a component that provided the person context')
  }
  return context
}
