/**
 * Composable: useUncategorizedList
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
  movies,
  persons,
  companies,
  tvs,
  collectionGameLinks,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionMovieLinks,
  collectionPersonLinks,
  collectionCompanyLinks,
  collectionTvLinks
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
    case 'tv': {
      const linkedIds = await db
        .selectDistinct({ id: collectionTvLinks.tvId })
        .from(collectionTvLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(tvs)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(tvs.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(tvs.isNsfw, false)
          )
        )
    }
    case 'movie': {
      const linkedIds = await db
        .selectDistinct({ id: collectionMovieLinks.movieId })
        .from(collectionMovieLinks)
      const linkedIdSet = linkedIds.map((l) => l.id)

      return await db
        .select()
        .from(movies)
        .where(
          and(
            linkedIdSet.length > 0 ? notInArray(movies.id, linkedIdSet) : undefined,
            showNsfw ? undefined : eq(movies.isNsfw, false)
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

export const uncategorizedListData = defineRouteData((route) => {
  const entityType = (route.params.entityType as ContentEntityType) || 'game'
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchUncategorized(entityType, showNsfw.value)
})

export function useUncategorizedList() {
  const { data, error, isFetching, refetch } = uncategorizedListData()

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
    table === 'tvs' ||
    table === 'movies' ||
    table === 'characters' ||
    table === 'persons' ||
    table === 'companies' ||
    table.includes('collection')
  )
}
