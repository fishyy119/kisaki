/**
 * Composable: useUncategorizedList
 *
 * Route-loaded browse surface of the entities no visible collection holds.
 * The browsed type is the route's (the explorer links here per type), so a
 * type switch navigates; the rest of the list query lives beside the loader.
 */

import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  COLLECTION_LINKS,
  ENTITY_TABLES,
  buildUncategorizedScope,
  countEntities,
  queryEntities
} from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { getExplorerContextPath } from '@renderer/utils/explorer-context'
import {
  CONTENT_ENTITY_TYPES,
  parseContentEntityType,
  type ContentEntityType
} from '@shared/entity-types'
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
  switchEntityListType,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'

interface UncategorizedData {
  counts: ContentEntityCounts
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

async function fetchUncategorized(
  entityType: ContentEntityType,
  query: EntityListQuery,
  showNsfw: boolean
): Promise<UncategorizedData> {
  const counts = createEmptyContentEntityCounts()
  await Promise.all(
    CONTENT_ENTITY_TYPES.map(async (type) => {
      counts[type] = await countEntities(type, {
        scope: buildUncategorizedScope(type, showNsfw),
        includeNsfw: showNsfw
      })
    })
  )

  const entities = await queryEntities(entityType, {
    scope: buildUncategorizedScope(entityType, showNsfw),
    search: query.search,
    filter: query.filter,
    sort: query.sort,
    includeNsfw: showNsfw
  })

  return { counts, entityType, entities }
}

// The list query lives beside the loader so the navigation-time fetch reads a
// consistent value; the browsed type follows the route and resets the
// type-bound parts of the query whenever it changes.
const routeQuery = shallowRef<EntityListQuery>(createEntityListQuery(null))

/** `null` when the route names no content entity type. */
export const uncategorizedListData = defineRouteData(
  async (route): Promise<UncategorizedData | null> => {
    const param = route.params.entityType
    const entityType = typeof param === 'string' ? parseContentEntityType(param) : null
    if (!entityType) return null

    if (routeQuery.value.entityType !== entityType) {
      routeQuery.value = switchEntityListType(routeQuery.value, entityType)
    }
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return fetchUncategorized(entityType, routeQuery.value, showNsfw.value)
  }
)

export function useUncategorizedList() {
  const router = useRouter()
  const { data, error, isFetching, refetch } = uncategorizedListData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  const query = computed({
    get: () => routeQuery.value,
    set: (next: EntityListQuery) => {
      // The browsed type is the route's: a type switch navigates, and the
      // loader re-reads the query for the new type.
      if (next.entityType !== null && next.entityType !== routeQuery.value.entityType) {
        void router.replace(getExplorerContextPath({ kind: 'uncategorized' }, next.entityType))
        return
      }
      routeQuery.value = next
      void refetch()
    }
  })

  /** `null` while the route names no content entity type. */
  const entityType = computed(() => data.value?.entityType ?? null)

  // Membership changes on either side move rows in and out; the browsed
  // type's filter tables feed the visible list.
  const relevantTables = computed(() => {
    const tables = new Set<TableName>()
    for (const type of CONTENT_ENTITY_TYPES) {
      tables.add(ENTITY_TABLES[type].tableName)
      tables.add(COLLECTION_LINKS[type].tableName)
    }
    tables.add('collections')
    if (entityType.value) {
      for (const table of getFilterRelevantTables(entityType.value)) tables.add(table)
    }
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
