/**
 * Character data composable
 *
 * Provides character data with all related entities using Provider/Consumer pattern.
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
  Character,
  CharacterTagLink,
  GameCharacterLink,
  AnimeCharacterLink,
  TvCharacterLink,
  MovieCharacterLink,
  CharacterPersonLink,
  Game,
  Anime,
  Tv,
  Movie,
  Person,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

interface CharacterData {
  character: Character
  tags: (CharacterTagLink & { tag: Tag | null })[]
  games: (GameCharacterLink & { game: Game | null })[]
  animes: (AnimeCharacterLink & { anime: Anime | null })[]
  tvs: (TvCharacterLink & { tv: Tv | null })[]
  movies: (MovieCharacterLink & { movie: Movie | null })[]
  persons: (CharacterPersonLink & { person: Person | null })[]
}

export interface CharacterContext {
  character: ComputedRef<Character | null>
  tags: ComputedRef<(CharacterTagLink & { tag: Tag | null })[]>
  games: ComputedRef<(GameCharacterLink & { game: Game | null })[]>
  animes: ComputedRef<(AnimeCharacterLink & { anime: Anime | null })[]>
  tvs: ComputedRef<(TvCharacterLink & { tv: Tv | null })[]>
  movies: ComputedRef<(MovieCharacterLink & { movie: Movie | null })[]>
  persons: ComputedRef<(CharacterPersonLink & { person: Person | null })[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

export interface CharacterProviderReturn extends CharacterContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const CharacterKey: InjectionKey<CharacterContext> = Symbol('character')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchCharacterData(
  characterId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<CharacterData | null> {
  if (!characterId) return null

  const characterWhere = and(
    eq(schema.characters.id, characterId),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )
  const [charData] = await db.select().from(schema.characters).where(characterWhere).limit(1)

  if (!charData) return null

  const characterTagLinksWhere = and(
    eq(schema.characterTagLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.characterTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCharacterLinksWhere = and(
    eq(schema.gameCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.gameCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animeCharacterLinksWhere = and(
    eq(schema.animeCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.animeCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const tvCharacterLinksWhere = and(
    eq(schema.tvCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.tvCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tvs.isNsfw, false)
  )

  const movieCharacterLinksWhere = and(
    eq(schema.movieCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.movieCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.movies.isNsfw, false)
  )

  const characterPersonLinksWhere = and(
    eq(schema.characterPersonLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.characterPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, tvLinks, movieLinks, personLinks] = await Promise.all([
    db
      .select()
      .from(schema.characterTagLinks)
      .leftJoin(schema.tags, eq(schema.characterTagLinks.tagId, schema.tags.id))
      .where(characterTagLinksWhere)
      .orderBy(asc(schema.characterTagLinks.orderInCharacter)),
    db
      .select()
      .from(schema.gameCharacterLinks)
      .leftJoin(schema.games, eq(schema.gameCharacterLinks.gameId, schema.games.id))
      .where(gameCharacterLinksWhere)
      .orderBy(asc(schema.gameCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.animeCharacterLinks)
      .leftJoin(schema.animes, eq(schema.animeCharacterLinks.animeId, schema.animes.id))
      .where(animeCharacterLinksWhere)
      .orderBy(asc(schema.animeCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.tvCharacterLinks)
      .leftJoin(schema.tvs, eq(schema.tvCharacterLinks.tvId, schema.tvs.id))
      .where(tvCharacterLinksWhere)
      .orderBy(asc(schema.tvCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.movieCharacterLinks)
      .leftJoin(schema.movies, eq(schema.movieCharacterLinks.movieId, schema.movies.id))
      .where(movieCharacterLinksWhere)
      .orderBy(asc(schema.movieCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.characterPersonLinks)
      .leftJoin(schema.persons, eq(schema.characterPersonLinks.personId, schema.persons.id))
      .where(characterPersonLinksWhere)
      .orderBy(asc(schema.characterPersonLinks.orderInCharacter))
  ])

  return {
    character: charData,
    tags: tagLinks.map((row) => ({ ...row.character_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_character_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_character_links, anime: row.animes })),
    tvs: tvLinks.map((row) => ({ ...row.tv_character_links, tv: row.tvs })),
    movies: movieLinks.map((row) => ({ ...row.movie_character_links, movie: row.movies })),
    persons: personLinks.map((row) => ({ ...row.character_person_links, person: row.persons }))
  }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different entity loads.
let lastRouteCharacterId: string | null = null
const routeSpoilersRevealed = ref(false)

export const characterDetailData = defineRouteData((route) => {
  const characterId = route.params.characterId as string
  if (characterId !== lastRouteCharacterId) {
    lastRouteCharacterId = characterId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchCharacterData(characterId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface CharacterDataSource {
  data: Readonly<Ref<CharacterData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideCharacterContext(source: CharacterDataSource): CharacterContext {
  const context: CharacterContext = {
    character: computed(() => source.data.value?.character ?? null),
    tags: computed(() => source.data.value?.tags ?? []),
    games: computed(() => source.data.value?.games ?? []),
    animes: computed(() => source.data.value?.animes ?? []),
    tvs: computed(() => source.data.value?.tvs ?? []),
    movies: computed(() => source.data.value?.movies ?? []),
    persons: computed(() => source.data.value?.persons ?? []),
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(CharacterKey, context)

  return context
}

const CHARACTER_LINK_TABLES: readonly TableName[] = [
  'character_tag_links',
  'game_character_links',
  'anime_character_links',
  'tv_character_links',
  'movie_character_links',
  'character_person_links'
]

function useCharacterDbSync(
  characterId: MaybeRefOrGetter<string>,
  refetch: () => Promise<void>
): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (CHARACTER_LINK_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'characters' && entityId === toValue(characterId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide character data on the route surface (data settled during navigation).
 */
export function useCharacterRouteProvider(): CharacterProviderReturn {
  const route = useRoute()
  const characterId = computed(() => route.params.characterId as string)
  const { data, error, isFetching, refetch } = characterDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const spoilersRevealed = computed({
    get: () => routeSpoilersRevealed.value,
    set: (value) => {
      routeSpoilersRevealed.value = value
      void refetch()
    }
  })

  const context = provideCharacterContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useCharacterDbSync(characterId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide character data on the dialog surface (fetches after mount).
 */
export function useCharacterDialogProvider(
  characterId: MaybeRefOrGetter<string>
): CharacterProviderReturn {
  const id = toRef(characterId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchCharacterData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideCharacterContext({ data, isLoading, isFetching, error, refetch })
  useCharacterDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

export function useCharacter(): CharacterContext {
  const context = inject(CharacterKey)
  if (!context) {
    throw new Error(
      'useCharacter() must be used within a component that provided the character context'
    )
  }
  return context
}
