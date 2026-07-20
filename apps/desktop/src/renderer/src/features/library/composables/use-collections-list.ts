/**
 * Composable: useCollectionsList
 *
 * Route-loaded list of all collections for the collections page.
 */

import { computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useEvent } from '@renderer/composables'
import { usePreferencesStore } from '@renderer/stores'
import { collections } from '@shared/db'

export const collectionsListData = defineRouteData(async () => {
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return await db
    .select()
    .from(collections)
    .where(showNsfw.value ? undefined : eq(collections.isNsfw, false))
})

export function useCollectionsList() {
  const { data, error, isFetching, refetch } = collectionsListData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  useEvent('db.inserted', ({ table }) => {
    if (table === 'collections') refetch()
  })
  useEvent('db.updated', ({ table }) => {
    if (table === 'collections') refetch()
  })
  useEvent('db.deleted', ({ table }) => {
    if (table === 'collections') refetch()
  })

  return {
    collections: computed(() => data.value ?? []),
    error,
    isFetching,
    refetch
  }
}
