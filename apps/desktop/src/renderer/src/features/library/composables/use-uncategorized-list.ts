/**
 * Composable: useUncategorizedList
 *
 * Route-loaded list of entities not assigned to any collection.
 * The entity type comes from the route param.
 */

import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { COLLECTION_LINKS, ENTITY_TABLES, db, queryEntities } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import { useDbChanges, type ContentEntityData } from '@renderer/composables'

async function fetchUncategorized(
  entityType: ContentEntityType,
  showNsfw: boolean
): Promise<ContentEntityData[]> {
  const link = COLLECTION_LINKS[entityType]

  const linkedRows = await db.selectDistinct({ id: link.entityIdColumn }).from(link.table)
  const linkedIds = linkedRows.map((row) => row.id as string)

  return queryEntities(entityType, { excludeIds: linkedIds, includeNsfw: showNsfw })
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

/** Membership changes on either side move rows in and out of the list. */
function isRelevantTable(table: string): boolean {
  return CONTENT_ENTITY_TYPES.some(
    (type) => table === ENTITY_TABLES[type].tableName || table === COLLECTION_LINKS[type].tableName
  )
}
