/**
 * Game data composable
 *
 * Provides game data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `gameDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useGameRouteProvider()`.
 * - Dialog: `useGameDialogProvider()` fetches on demand after mount.
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
import { eq, asc, desc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import type {
  Game,
  GameNote,
  GameCharacterLink,
  GamePersonLink,
  GameCompanyLink,
  GameTagLink,
  GameSession,
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

interface GameData {
  game: Game | null
  notes: GameNote[]
  tags: (GameTagLink & { tag: Tag | null })[]
  characters: (GameCharacterLink & { character: Character | null })[]
  persons: (GamePersonLink & { person: Person | null })[]
  companies: (GameCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: GameSession[]
}

export interface GameContext {
  /** Game data */
  game: ComputedRef<Game | null>
  /** Game notes (from gameNotes) */
  notes: ComputedRef<GameNote[]>
  /** Game tags (from gameTagLinks) */
  tags: ComputedRef<(GameTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(GameCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(GamePersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(GameCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Game sessions (play history) */
  sessions: ComputedRef<GameSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface GameProviderReturn extends GameContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const GameKey: InjectionKey<GameContext> = Symbol('game')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchGameData(
  gameId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<GameData | null> {
  if (!gameId) return null

  // First check if game exists
  const gameWhere = and(
    eq(schema.games.id, gameId),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )
  const [gameData] = await db.select().from(schema.games).where(gameWhere).limit(1)

  if (!gameData) return null

  const gameTagLinksWhere = and(
    eq(schema.gameTagLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCharacterLinksWhere = and(
    eq(schema.gameCharacterLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const gamePersonLinksWhere = and(
    eq(schema.gamePersonLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gamePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const gameCompanyLinksWhere = and(
    eq(schema.gameCompanyLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  // Parallel fetch all related data
  const [notes, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.gameNotes)
        .where(eq(schema.gameNotes.gameId, gameId))
        .orderBy(asc(schema.gameNotes.orderInGame), asc(schema.gameNotes.name)),
      db
        .select()
        .from(schema.gameTagLinks)
        .leftJoin(schema.tags, eq(schema.gameTagLinks.tagId, schema.tags.id))
        .where(gameTagLinksWhere)
        .orderBy(asc(schema.gameTagLinks.orderInGame)),
      db
        .select()
        .from(schema.gameCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.gameCharacterLinks.characterId, schema.characters.id)
        )
        .where(gameCharacterLinksWhere)
        .orderBy(asc(schema.gameCharacterLinks.orderInGame)),
      db
        .select()
        .from(schema.gamePersonLinks)
        .leftJoin(schema.persons, eq(schema.gamePersonLinks.personId, schema.persons.id))
        .where(gamePersonLinksWhere)
        .orderBy(asc(schema.gamePersonLinks.orderInGame)),
      db
        .select()
        .from(schema.gameCompanyLinks)
        .leftJoin(schema.companies, eq(schema.gameCompanyLinks.companyId, schema.companies.id))
        .where(gameCompanyLinksWhere)
        .orderBy(asc(schema.gameCompanyLinks.orderInGame)),
      fetchMediaRelations('game', gameId, showNsfw),
      db
        .select()
        .from(schema.gameSessions)
        .where(eq(schema.gameSessions.gameId, gameId))
        .orderBy(desc(schema.gameSessions.startedAt))
    ])

  return {
    game: gameData,
    notes,
    tags: tagLinks.map((row) => ({ ...row.game_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.game_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.game_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.game_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different game loads.
let lastRouteGameId: string | null = null
const routeSpoilersRevealed = ref(false)

export const gameDetailData = defineRouteData((route) => {
  const gameId = route.params.gameId as string
  if (gameId !== lastRouteGameId) {
    lastRouteGameId = gameId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchGameData(gameId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface GameDataSource {
  data: Readonly<Ref<GameData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideGameContext(source: GameDataSource): GameContext {
  const context: GameContext = {
    game: computed(() => source.data.value?.game ?? null),
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

  provide(GameKey, context)

  return context
}

const GAME_OWNED_TABLES = [
  'game_notes',
  'game_sessions',
  'game_tag_links',
  'game_character_links',
  'game_person_links',
  'game_company_links',
  'media_relations'
]

function useGameDbSync(gameId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (GAME_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'games' && entityId === toValue(gameId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide game data on the route surface.
 *
 * Data is loaded by `gameDetailData` during navigation, so it is already
 * settled when the page mounts. In-page input changes (spoilers, NSFW
 * preference) trigger a non-blocking SWR refetch.
 */
export function useGameRouteProvider(): GameProviderReturn {
  const route = useRoute()
  const gameId = computed(() => route.params.gameId as string)
  const { data, error, isFetching, refetch } = gameDetailData()

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

  const context = provideGameContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useGameDbSync(gameId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide game data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useGameDialogProvider(gameId: MaybeRefOrGetter<string>): GameProviderReturn {
  const id = toRef(gameId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchGameData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideGameContext({ data, isLoading, isFetching, error, refetch })
  useGameDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume game data context
 *
 * Call this in child components to access game data.
 *
 * @example
 * ```ts
 * // In game-header.vue (child component)
 * const { game } = useGame()
 * ```
 */
export function useGame(): GameContext {
  const context = inject(GameKey)
  if (!context) {
    throw new Error('useGame() must be used within a component that provided the game context')
  }
  return context
}
