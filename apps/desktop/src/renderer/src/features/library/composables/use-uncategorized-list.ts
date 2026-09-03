/**
 * Composable: useUncategorizedList
 *
 * Route data of the browse surface of the entities no visible collection
 * holds. The browsed type is the route's (the explorer links here per type),
 * so a type switch navigates; the rest of the list query is the surface's
 * params and carries over a type switch where the new type's spec allows.
 */

import { computed } from 'vue'
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
import { getQueryDependencyTables } from '@shared/filter'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from '@renderer/composables/content-entities'
import {
  createEntityListQuery,
  switchEntityListType,
  type EntityListQuery,
  type OrganizerDetailParams
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

/** `null` data when the route names no content entity type. */
export const uncategorizedListData = defineRouteData({
  name: 'uncategorized',
  key: (route) => {
    const param = route.params.entityType
    return typeof param === 'string' ? parseContentEntityType(param) : null
  },
  // A type switch keeps the sort when the new type's spec declares its key.
  params: (entityType, previous): OrganizerDetailParams => ({
    query: previous
      ? switchEntityListType(previous.query, entityType)
      : createEntityListQuery(entityType)
  }),
  view: () => {
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return { showNsfw: showNsfw.value }
  },
  fetch: ({ key, params, view }) => fetchUncategorized(key, params.query, view.showNsfw),
  invalidate: {
    // Membership on either side moves rows in and out of every count; the
    // browsed type's query tables feed the visible list.
    reads: ({ key, params }) => {
      const tables = new Set<TableName>(['collections'])
      for (const type of CONTENT_ENTITY_TYPES) {
        tables.add(ENTITY_TABLES[type].tableName)
        tables.add(COLLECTION_LINKS[type].tableName)
      }
      for (const table of getQueryDependencyTables(key, params.query)) tables.add(table)
      return [...tables]
    }
  }
})

export function useUncategorizedList() {
  const router = useRouter()
  const { data, error, isFetching, params, reload } = uncategorizedListData()

  const query = computed({
    get: () => params.query.value,
    set: (next: EntityListQuery) => {
      // The browsed type is the route's: a type switch navigates, and the
      // resource recomputes its params for the new key.
      if (next.entityType !== null && next.entityType !== params.query.value.entityType) {
        void router.replace(getExplorerContextPath({ kind: 'uncategorized' }, next.entityType))
        return
      }
      params.query.value = next
    }
  })

  return {
    entities: computed(() => data.value?.entities ?? []),
    counts: computed(() => data.value?.counts ?? createEmptyContentEntityCounts()),
    /** `null` while the route names no content entity type. */
    entityType: computed(() => data.value?.entityType ?? null),
    query,
    error,
    isFetching,
    refetch: reload
  }
}
