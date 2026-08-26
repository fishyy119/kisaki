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
  ComicPersonLink,
  NovelPersonLink,
  CharacterPersonLink,
  PersonTagLink,
  Game,
  Anime,
  Comic,
  Novel,
  Character,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import type { MediaType } from '@shared/common'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

interface PersonData {
  person: Person
  tags: (PersonTagLink & { tag: Tag | null })[]
  games: (GamePersonLink & { game: Game | null })[]
  animes: (AnimePersonLink & { anime: Anime | null })[]
  comics: (ComicPersonLink & { comic: Comic | null })[]
  novels: (NovelPersonLink & { novel: Novel | null })[]
  characters: (CharacterPersonLink & { character: Character | null })[]
  cast: PersonCastEntry[]
}

/**
 * One entry where this person is credited voicing a character, and which one.
 *
 * The knowledge-layer `characters` list says who they voice at all; this says
 * where that was actually credited, which is what separates a role they still
 * hold from one they were recast out of.
 */
export interface PersonCastEntry {
  id: string
  mediaType: MediaType
  mediaId: string
  mediaName: string
  character: Character | null
}

export interface PersonContext {
  person: ComputedRef<Person | null>
  tags: ComputedRef<(PersonTagLink & { tag: Tag | null })[]>
  games: ComputedRef<(GamePersonLink & { game: Game | null })[]>
  animes: ComputedRef<(AnimePersonLink & { anime: Anime | null })[]>
  comics: ComputedRef<(ComicPersonLink & { comic: Comic | null })[]>
  novels: ComputedRef<(NovelPersonLink & { novel: Novel | null })[]>
  characters: ComputedRef<(CharacterPersonLink & { character: Character | null })[]>
  /** Confirmed voice credits of this person, one row per entry and character */
  cast: ComputedRef<PersonCastEntry[]>
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

  const comicPersonLinksWhere = and(
    eq(schema.comicPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.comicPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )

  const novelPersonLinksWhere = and(
    eq(schema.novelPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.novelPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )

  const characterPersonLinksWhere = and(
    eq(schema.characterPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.characterPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  // A cast row names both endpoints, so either being hidden hides the credit.
  const gameCastLinksWhere = and(
    eq(schema.gameCastLinks.personId, personId),
    showNsfw ? undefined : eq(schema.games.isNsfw, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const animeCastLinksWhere = and(
    eq(schema.animeCastLinks.personId, personId),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, comicLinks, novelLinks, charLinks, gameCast, animeCast] =
    await Promise.all([
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
        .from(schema.comicPersonLinks)
        .leftJoin(schema.comics, eq(schema.comicPersonLinks.comicId, schema.comics.id))
        .where(comicPersonLinksWhere)
        .orderBy(asc(schema.comicPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.novelPersonLinks)
        .leftJoin(schema.novels, eq(schema.novelPersonLinks.novelId, schema.novels.id))
        .where(novelPersonLinksWhere)
        .orderBy(asc(schema.novelPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.characterPersonLinks)
        .leftJoin(
          schema.characters,
          eq(schema.characterPersonLinks.characterId, schema.characters.id)
        )
        .where(characterPersonLinksWhere)
        .orderBy(asc(schema.characterPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.gameCastLinks)
        .innerJoin(schema.games, eq(schema.gameCastLinks.gameId, schema.games.id))
        .leftJoin(schema.characters, eq(schema.gameCastLinks.characterId, schema.characters.id))
        .where(gameCastLinksWhere)
        .orderBy(asc(schema.games.name)),
      db
        .select()
        .from(schema.animeCastLinks)
        .innerJoin(schema.animes, eq(schema.animeCastLinks.animeId, schema.animes.id))
        .leftJoin(schema.characters, eq(schema.animeCastLinks.characterId, schema.characters.id))
        .where(animeCastLinksWhere)
        .orderBy(asc(schema.animes.name))
    ])

  return {
    person: personData,
    tags: tagLinks.map((row) => ({ ...row.person_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_person_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_person_links, anime: row.animes })),
    comics: comicLinks.map((row) => ({ ...row.comic_person_links, comic: row.comics })),
    novels: novelLinks.map((row) => ({ ...row.novel_person_links, novel: row.novels })),
    characters: charLinks.map((row) => ({
      ...row.character_person_links,
      character: row.characters
    })),
    cast: [
      ...gameCast.map((row) => ({
        id: row.game_cast_links.id,
        mediaType: 'game' as const,
        mediaId: row.games.id,
        mediaName: row.games.name,
        character: row.characters
      })),
      ...animeCast.map((row) => ({
        id: row.anime_cast_links.id,
        mediaType: 'anime' as const,
        mediaId: row.animes.id,
        mediaName: row.animes.name,
        character: row.characters
      }))
    ]
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
    comics: computed(() => source.data.value?.comics ?? []),
    novels: computed(() => source.data.value?.novels ?? []),
    characters: computed(() => source.data.value?.characters ?? []),
    cast: computed(() => source.data.value?.cast ?? []),
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
  'comic_person_links',
  'novel_person_links',
  'game_cast_links',
  'anime_cast_links',
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
