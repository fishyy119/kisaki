/**
 * Composable: useCollectionsList
 *
 * Route data of the collections page: every visible collection in the user's
 * own order.
 */

import { computed } from 'vue'
import { asc, eq } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { collections } from '@shared/db'

export const collectionsListData = defineRouteData({
  name: 'collections',
  key: () => 'collections',
  view: () => {
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return { showNsfw: showNsfw.value }
  },
  // The user's own arrangement is the canonical collection order, matching
  // the explorer's group order.
  fetch: async ({ view }) =>
    await db
      .select()
      .from(collections)
      .where(view.showNsfw ? undefined : eq(collections.isNsfw, false))
      .orderBy(asc(collections.order)),
  invalidate: { reads: ['collections'] }
})

export function useCollectionsList() {
  const { data, error, isFetching, reload } = collectionsListData()

  return {
    collections: computed(() => data.value ?? []),
    error,
    isFetching,
    refetch: reload
  }
}
