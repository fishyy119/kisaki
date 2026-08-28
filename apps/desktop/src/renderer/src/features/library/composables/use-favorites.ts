/**
 * Composable: useFavorites
 *
 * Route-loaded favorites list with in-page entity type tab switching (SWR).
 */

import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ENTITY_TABLES, queryEntities } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import type { FilterState } from '@shared/filter'
import { useDbChanges } from '@renderer/composables/use-db-changes'
import type { ContentEntityData } from '@renderer/composables/content-entities'

interface FavoritesData {
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

const FAVORITES_FILTER: FilterState = {
  match: 'all',
  conditions: [{ field: 'isFavorite', op: 'is', value: true }]
}

async function fetchFavorites(
  entityType: ContentEntityType,
  showNsfw: boolean
): Promise<FavoritesData> {
  const entities = await queryEntities(entityType, {
    filter: FAVORITES_FILTER,
    includeNsfw: showNsfw
  })

  return { entityType, entities }
}

// In-page tab selection lives beside the loader so the navigation-time fetch
// reads a consistent value; it persists across navigations by design.
const selectedEntityType = ref<ContentEntityType>('game')

export const favoritesData = defineRouteData(() => {
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchFavorites(selectedEntityType.value, showNsfw.value)
})

export function useFavorites() {
  const { data, error, isFetching, refetch } = favoritesData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  // Tab switching triggers a non-blocking SWR refetch; the previous tab's
  // entities stay visible until the new data lands.
  const entityType = computed({
    get: () => data.value?.entityType ?? selectedEntityType.value,
    set: (type: ContentEntityType) => {
      selectedEntityType.value = type
      void refetch()
    }
  })

  useDbChanges(({ table }) => {
    if (CONTENT_ENTITY_TYPES.some((type) => ENTITY_TABLES[type].tableName === table)) refetch()
  })

  return {
    entities: computed(() => data.value?.entities ?? []),
    entityType,
    error,
    isFetching,
    refetch
  }
}
