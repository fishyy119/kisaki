/**
 * Composable: useCollectionsList
 *
 * Route query of the collections page: every visible collection in the
 * user's own order.
 */

import { computed } from 'vue'
import { asc, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteQuery } from '@renderer/core/query'
import { visibilityView } from '@renderer/stores'
import { collections } from '@shared/db'

export const collectionsQuery = defineRouteQuery({
  name: 'collections',
  key: () => 'collections',
  view: visibilityView,
  // The user's own arrangement is the canonical collection order, matching
  // the explorer's group order.
  fetch: async ({ view }) =>
    await db
      .select()
      .from(collections)
      .where(view.showNsfw ? undefined : eq(collections.isNsfw, false))
      .orderBy(asc(collections.order)),
  invalidate: { tables: ['collections'] }
})

export function useCollectionsList() {
  const { data, error } = collectionsQuery()

  return {
    collections: computed(() => data.value ?? []),
    error
  }
}
