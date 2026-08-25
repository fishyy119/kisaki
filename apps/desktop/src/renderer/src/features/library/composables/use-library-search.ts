/**
 * Library Search Composable
 *
 * Provides FTS-backed search across all entity types in the library.
 * Uses SQLite FTS5 with prefix matching for responsive search.
 */

import { ref, watch, computed, toValue, onUnmounted, type MaybeRefOrGetter } from 'vue'
import { sql, and, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { games, animes, comics, novels, characters, persons, companies } from '@shared/db'
import type { Game, Anime, Comic, Novel, Character, Person, Company } from '@shared/db'
import { buildFtsMatchText, normalizeSearchText } from '@shared/search'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@renderer/stores'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Library')

// =============================================================================
// Types
// =============================================================================

export interface LibrarySearchResult {
  games: Game[]
  animes: Anime[]
  comics: Comic[]
  novels: Novel[]
  characters: Character[]
  persons: Person[]
  companies: Company[]
}

const EMPTY_RESULT: LibrarySearchResult = {
  games: [],
  animes: [],
  comics: [],
  novels: [],
  characters: [],
  persons: [],
  companies: []
}

// =============================================================================
// Composable
// =============================================================================

/**
 * Composable for searching across all entity types using FTS5
 *
 * @param query - Search query string (reactive)
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Search results grouped by entity type and loading state
 */
export function useLibrarySearch(query: MaybeRefOrGetter<string>, debounceMs = 300) {
  const results = ref<LibrarySearchResult>(EMPTY_RESULT)
  const isLoading = ref(false)
  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  // Debounced query
  const debouncedQuery = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // Track fetch version to handle race conditions
  let fetchVersion = 0

  // Watch query and debounce
  watch(
    () => toValue(query),
    (newQuery) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        debouncedQuery.value = normalizeSearchText(newQuery) ?? ''
      }, debounceMs)
    },
    { immediate: true }
  )

  // Perform search when debounced query changes
  watch(
    [debouncedQuery, showNsfw],
    async ([searchQuery]) => {
      if (!searchQuery) {
        results.value = EMPTY_RESULT
        isLoading.value = false
        return
      }

      const currentVersion = ++fetchVersion
      const searchTerm = buildFtsMatchText(searchQuery)
      if (!searchTerm) {
        results.value = EMPTY_RESULT
        isLoading.value = false
        return
      }
      isLoading.value = true

      try {
        // Parallel FTS queries for all entity types
        const [
          gamesResult,
          animesResult,
          comicsResult,
          novelsResult,
          charactersResult,
          personsResult,
          companiesResult
        ] = await Promise.all([
          // Games search
          db
            .select()
            .from(games)
            .where(
              and(
                sql`${games}.rowid IN (SELECT rowid FROM games_fts WHERE games_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(games.isNsfw, false)
              )
            ),

          // Animes search
          db
            .select()
            .from(animes)
            .where(
              and(
                sql`${animes}.rowid IN (SELECT rowid FROM animes_fts WHERE animes_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(animes.isNsfw, false)
              )
            ),

          // Comics search
          db
            .select()
            .from(comics)
            .where(
              and(
                sql`${comics}.rowid IN (SELECT rowid FROM comics_fts WHERE comics_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(comics.isNsfw, false)
              )
            ),

          // Novels search
          db
            .select()
            .from(novels)
            .where(
              and(
                sql`${novels}.rowid IN (SELECT rowid FROM novels_fts WHERE novels_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(novels.isNsfw, false)
              )
            ),

          // Characters search
          db
            .select()
            .from(characters)
            .where(
              and(
                sql`${characters}.rowid IN (SELECT rowid FROM characters_fts WHERE characters_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(characters.isNsfw, false)
              )
            ),

          // Persons search
          db
            .select()
            .from(persons)
            .where(
              and(
                sql`${persons}.rowid IN (SELECT rowid FROM persons_fts WHERE persons_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(persons.isNsfw, false)
              )
            ),

          // Companies search
          db
            .select()
            .from(companies)
            .where(
              and(
                sql`${companies}.rowid IN (SELECT rowid FROM companies_fts WHERE companies_fts MATCH ${searchTerm})`,
                showNsfw.value ? undefined : eq(companies.isNsfw, false)
              )
            )
        ])

        // Only update if this is still the latest search
        if (currentVersion === fetchVersion) {
          results.value = {
            games: gamesResult,
            animes: animesResult,
            comics: comicsResult,
            novels: novelsResult,
            characters: charactersResult,
            persons: personsResult,
            companies: companiesResult
          }
        }
      } catch (error) {
        log.error('Search failed:', error)
        if (currentVersion === fetchVersion) {
          results.value = EMPTY_RESULT
        }
      } finally {
        if (currentVersion === fetchVersion) {
          isLoading.value = false
        }
      }
    },
    { immediate: true }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  const hasResults = computed(() =>
    Object.values(results.value).some((entities) => entities.length > 0)
  )

  return {
    results,
    isLoading,
    hasResults,
    query: debouncedQuery
  }
}
