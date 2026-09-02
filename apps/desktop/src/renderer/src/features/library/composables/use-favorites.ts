/**
 * Composable: useFavorites
 *
 * Route-loaded favorites browse surface: member counts per content type and
 * the favorites of the browsed type under the page's list query (SWR).
 */

import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES, FAVORITES_SCOPE, countEntities, queryEntities } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import { getFilterRelevantTables } from '@shared/filter'
import { batchTouchesAny, useDbChanges } from '@renderer/composables/use-db-changes'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from '@renderer/composables/content-entities'
import {
  createEntityListQuery,
  resolveEntityListType,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'

interface FavoritesData {
  counts: ContentEntityCounts
  /** Type actually shown; the query only carries the request. */
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

async function fetchFavorites(query: EntityListQuery, showNsfw: boolean): Promise<FavoritesData> {
  const counts = createEmptyContentEntityCounts()
  await Promise.all(
    CONTENT_ENTITY_TYPES.map(async (type) => {
      counts[type] = await countEntities(type, { scope: FAVORITES_SCOPE, includeNsfw: showNsfw })
    })
  )

  const entityType = resolveEntityListType(query.entityType, counts)
  const entities = await queryEntities(entityType, {
    scope: FAVORITES_SCOPE,
    search: query.search,
    filter: query.filter,
    sort: query.sort,
    includeNsfw: showNsfw
  })

  return { counts, entityType, entities }
}

// The page's list query lives beside the loader so the navigation-time fetch
// reads a consistent value; it persists across navigations by design.
const routeQuery = shallowRef<EntityListQuery>(createEntityListQuery(null))

export const favoritesData = defineRouteData(() => {
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchFavorites(routeQuery.value, showNsfw.value)
})

export function useFavorites() {
  const { data, error, isFetching, refetch } = favoritesData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  // Query changes trigger a non-blocking SWR refetch; the previous list stays
  // visible until the new data lands.
  const query = computed({
    get: () => routeQuery.value,
    set: (next: EntityListQuery) => {
      routeQuery.value = next
      void refetch()
    }
  })

  const entityType = computed(() => data.value?.entityType ?? 'game')

  // Every entity table feeds a count and a favorite flag; the browsed type's
  // filter tables feed the visible list.
  const relevantTables = computed(() => {
    const tables = new Set<TableName>(
      CONTENT_ENTITY_TYPES.map((type) => ENTITY_TABLES[type].tableName)
    )
    for (const table of getFilterRelevantTables(entityType.value)) tables.add(table)
    return tables
  })

  useDbChanges((batch) => {
    if (batchTouchesAny(batch, relevantTables.value)) refetch()
  })

  return {
    entities: computed(() => data.value?.entities ?? []),
    counts: computed(() => data.value?.counts ?? createEmptyContentEntityCounts()),
    entityType,
    query,
    error,
    isFetching,
    refetch
  }
}
