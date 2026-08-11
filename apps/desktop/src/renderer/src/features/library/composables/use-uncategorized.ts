/**
 * Composable: useUncategorized
 *
 * Route-loaded list of entities not assigned to any collection.
 * The entity type comes from the route param.
 */

import { computed, watch } from 'vue'
import { notInArray, and, eq } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import {
  games,
  animes,
  characters,
  persons,
  companies,
  collectionGameLinks,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionPersonLinks,
  collectionCompanyLinks
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import { useDbChanges, type ContentEntityData } from '@renderer/composables'

async function fetchUncategorized(
  entityType: ContentEntityType,
  showNsfw: boolean
): Promise<ContentEntityData[]> {
  switch (entityType) {
    case 'game': {
      const linkedIds = await db
        .selectDistinct({ id: collectionGameLinks.gameId })
        .from(collectionGameLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(games)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(games.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(games.isNsfw, false)
          )
        )
    }
    case 'anime': {
      const linkedIds = await db
        .selectDistinct({ id: collectionAnimeLinks.animeId })
        .from(collectionAnimeLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(animes)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(animes.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(animes.isNsfw, false)
          )
        )
    }
    case 'character': {
      const linkedIds = await db
        .selectDistinct({ id: collectionCharacterLinks.characterId })
        .from(collectionCharacterLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(characters)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(characters.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(characters.isNsfw, false)
          )
        )
    }
    case 'person': {
      const linkedIds = await db
        .selectDistinct({ id: collectionPersonLinks.personId })
        .from(collectionPersonLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(persons)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(persons.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(persons.isNsfw, false)
          )
        )
    }
    case 'company': {
      const linkedIds = await db
        .selectDistinct({ id: collectionCompanyLinks.companyId })
        .from(collectionCompanyLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(companies)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(companies.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(companies.isNsfw, false)
          )
        )
    }
  }
}

export const uncategorizedData = defineRouteData((route) => {
  const entityType = (route.params.entityType as ContentEntityType) || 'game'
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchUncategorized(entityType, showNsfw.value)
})

export function useUncategorized() {
  const { data, error, isFetching, refetch } = uncategorizedData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  useDbChanges(({ table }) => {
    if (isRelevantTable(table)) refetch()
  })

  return {
    entities: computed(() => data.value ?? []),
    error,
    isFetching,
    refetch
  }
}

function isRelevantTable(table: string): boolean {
  return (
    table === 'games' ||
    table === 'animes' ||
    table === 'characters' ||
    table === 'persons' ||
    table === 'companies' ||
    table.includes('collection')
  )
}
