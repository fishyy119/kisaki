/**
 * Library Search Composable
 *
 * Provides FTS-backed search across all content entity types in the library.
 * Uses SQLite FTS5 with prefix matching for responsive search.
 *
 * Hits are bounded per type and projected to what a result row renders (id,
 * name, thumbnail file), so a broad query never ships whole tables over IPC.
 */

import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { sql, and, eq } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db, ENTITY_TABLES } from '@renderer/core/db'
import { buildFtsMatchText, normalizeSearchText } from '@shared/search'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { useDebouncedRef } from '@renderer/composables/use-debounced-ref'
import { usePreferencesStore } from '@renderer/stores'

// =============================================================================
// Types
// =============================================================================

/** One search hit, carrying exactly what a result row renders. */
export interface LibrarySearchHit {
  id: string
  name: string
  /** Cover/photo/logo attachment file for the result thumbnail. */
  imageFile: string | null
}

export type LibrarySearchResult = Record<ContentEntityType, LibrarySearchHit[]>

/** Hits kept per entity type; a search surface lists candidates, not tables. */
const SEARCH_RESULT_LIMIT = 50

function createEmptyResult(): LibrarySearchResult {
  return Object.fromEntries(
    CONTENT_ENTITY_TYPES.map((entityType) => [entityType, [] as LibrarySearchHit[]])
  ) as LibrarySearchResult
}

async function searchEntityType(
  entityType: ContentEntityType,
  searchTerm: string,
  showNsfw: boolean
): Promise<LibrarySearchHit[]> {
  const def = ENTITY_TABLES[entityType]
  const fts = sql.raw(`${def.tableName}_fts`)

  const rows = await db
    .select({
      id: def.idColumn,
      name: def.nameColumn,
      imageFile: def.imageColumn ?? sql<string | null>`null`
    })
    .from(def.table)
    .where(
      and(
        sql`${def.table}.rowid IN (SELECT rowid FROM ${fts} WHERE ${fts} MATCH ${searchTerm})`,
        showNsfw ? undefined : eq(def.isNsfwColumn, false)
      )
    )
    .limit(SEARCH_RESULT_LIMIT)

  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    imageFile: (row.imageFile as string | null) ?? null
  }))
}

// =============================================================================
// Composable
// =============================================================================

/**
 * Composable for searching across all content entity types using FTS5
 *
 * @param query - Search query string (reactive)
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Search results grouped by entity type and fetching state
 */
export function useLibrarySearch(
  query: MaybeRefOrGetter<string>,
  debounceMs = 300
): {
  results: ComputedRef<LibrarySearchResult>
  isLoading: Ref<boolean>
  hasResults: ComputedRef<boolean>
  query: Ref<string>
} {
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const debouncedQuery = useDebouncedRef(
    computed(() => normalizeSearchText(toValue(query)) ?? ''),
    debounceMs
  )

  const { data, isFetching } = useAsyncData(
    async () => {
      const text = debouncedQuery.value
      if (!text) return createEmptyResult()

      const searchTerm = buildFtsMatchText(text)
      if (!searchTerm) return createEmptyResult()

      const perType = await Promise.all(
        CONTENT_ENTITY_TYPES.map((entityType) =>
          searchEntityType(entityType, searchTerm, showNsfw.value)
        )
      )

      return Object.fromEntries(
        CONTENT_ENTITY_TYPES.map((entityType, index) => [entityType, perType[index]!])
      ) as LibrarySearchResult
    },
    { watch: [debouncedQuery, showNsfw] }
  )

  const results = computed(() => data.value ?? createEmptyResult())

  const hasResults = computed(() =>
    CONTENT_ENTITY_TYPES.some((entityType) => results.value[entityType].length > 0)
  )

  return {
    results,
    isLoading: isFetching,
    hasResults,
    query: debouncedQuery
  }
}
