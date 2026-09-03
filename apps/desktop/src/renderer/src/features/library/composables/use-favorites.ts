/**
 * Composable: useFavorites
 *
 * Route data of the favorites browse surface: member counts per content type
 * and the favorites of the browsed type under the page's list query. The
 * surface has one identity, so its query persists across navigations.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES, FAVORITES_SCOPE, countEntities, queryEntities } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import { getQueryDependencyTables } from '@shared/filter'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from '@renderer/composables/content-entities'
import {
  createEntityListQuery,
  resolveEntityListType,
  type EntityListQuery,
  type OrganizerDetailParams
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

export const favoritesData = defineRouteData({
  name: 'favorites',
  key: () => 'favorites',
  params: (): OrganizerDetailParams => ({ query: createEntityListQuery(null) }),
  view: () => {
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return { showNsfw: showNsfw.value }
  },
  fetch: ({ params, view }) => fetchFavorites(params.query, view.showNsfw),
  invalidate: {
    // Every entity table feeds a count; the shown type's query tables feed the list.
    reads: ({ params, data }) => {
      const tables = new Set<TableName>(
        CONTENT_ENTITY_TYPES.map((type) => ENTITY_TABLES[type].tableName)
      )
      const shownType = data?.entityType ?? params.query.entityType
      for (const type of shownType ? [shownType] : CONTENT_ENTITY_TYPES) {
        for (const table of getQueryDependencyTables(type, params.query)) tables.add(table)
      }
      return [...tables]
    }
  }
})

export function useFavorites() {
  const { data, error, isFetching, params, reload } = favoritesData()

  return {
    entities: computed(() => data.value?.entities ?? []),
    counts: computed(() => data.value?.counts ?? createEmptyContentEntityCounts()),
    entityType: computed(() => data.value?.entityType ?? 'game'),
    /** Query changes trigger a non-blocking SWR refetch; the previous list stays until the new data lands. */
    query: params.query,
    error,
    isFetching,
    refetch: reload
  }
}
