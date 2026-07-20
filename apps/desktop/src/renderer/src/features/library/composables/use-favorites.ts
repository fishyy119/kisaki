/**
 * Composable: useFavorites
 *
 * Route-loaded favorites list with in-page entity type tab switching (SWR).
 */

import { computed, ref, watch } from 'vue'
import { eq, and } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useEvent } from '@renderer/composables'
import { usePreferencesStore } from '@renderer/stores'
import { games, characters, persons, companies } from '@shared/db'
import type { Game, Character, Person, Company } from '@shared/db'
import type { ContentEntityType } from '@shared/common'

type EntityData = Game | Character | Person | Company

interface FavoritesData {
  entityType: ContentEntityType
  entities: EntityData[]
}

async function fetchFavorites(
  entityType: ContentEntityType,
  showNsfw: boolean
): Promise<FavoritesData> {
  const fetchEntities = async (): Promise<EntityData[]> => {
    switch (entityType) {
      case 'game':
        return await db
          .select()
          .from(games)
          .where(and(eq(games.isFavorite, true), showNsfw ? undefined : eq(games.isNsfw, false)))
      case 'character':
        return await db
          .select()
          .from(characters)
          .where(
            and(
              eq(characters.isFavorite, true),
              showNsfw ? undefined : eq(characters.isNsfw, false)
            )
          )
      case 'person':
        return await db
          .select()
          .from(persons)
          .where(
            and(eq(persons.isFavorite, true), showNsfw ? undefined : eq(persons.isNsfw, false))
          )
      case 'company':
        return await db
          .select()
          .from(companies)
          .where(
            and(eq(companies.isFavorite, true), showNsfw ? undefined : eq(companies.isNsfw, false))
          )
    }
  }

  return { entityType, entities: await fetchEntities() }
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

  const contentTables = ['games', 'characters', 'persons', 'companies']
  useEvent('db.inserted', ({ table }) => {
    if (contentTables.includes(table)) refetch()
  })
  useEvent('db.updated', ({ table }) => {
    if (contentTables.includes(table)) refetch()
  })
  useEvent('db.deleted', ({ table }) => {
    if (contentTables.includes(table)) refetch()
  })

  return {
    entities: computed(() => data.value?.entities ?? []),
    entityType,
    error,
    isFetching,
    refetch
  }
}
