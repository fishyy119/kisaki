/**
 * Composable: useSectionData
 *
 * Fetches data for a single showcase section through the shared entity query
 * executor, refetching when any filter-relevant table changes.
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { storeToRefs } from 'pinia'
import { queryEntities, type EntityRowMap } from '@renderer/core/db'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import { getFilterRelevantTables } from '@shared/filter'
import type { ShowcaseSection } from '@shared/db/schema'
import { usePreferencesStore } from '@renderer/stores'

// =============================================================================
// Types
// =============================================================================

export type SectionEntityData = EntityRowMap[keyof EntityRowMap]

// =============================================================================
// Composable
// =============================================================================

export function useSectionData(section: MaybeRefOrGetter<ShowcaseSection>) {
  const preferencesStore = usePreferencesStore()
  const { showNsfw } = storeToRefs(preferencesStore)

  async function fetchData(): Promise<SectionEntityData[]> {
    const s = toValue(section)
    return await queryEntities(s.entityType, {
      filter: s.filter,
      sortField: s.sortField,
      sortDirection: s.sortDirection,
      limit: s.limit ?? undefined,
      includeNsfw: showNsfw.value
    })
  }

  // Create computed getters for watch dependencies
  const sectionId = computed(() => toValue(section).id)
  const sectionFilter = computed(() => toValue(section).filter)
  const sectionSortField = computed(() => toValue(section).sortField)
  const sectionSortDirection = computed(() => toValue(section).sortDirection)
  const sectionLimit = computed(() => toValue(section).limit)
  const sectionEntityType = computed(() => toValue(section).entityType)

  const { data, isLoading, isFetching, refetch } = useAsyncData(fetchData, {
    watch: [
      sectionId,
      sectionFilter,
      sectionSortField,
      sectionSortDirection,
      sectionLimit,
      showNsfw
    ]
  })

  // Listen for entity and relation link changes
  useDbChanges(({ table }) => {
    if (getFilterRelevantTables(sectionEntityType.value).includes(table)) refetch()
  })

  return {
    data: computed(() => data.value ?? []),
    isLoading,
    isFetching,
    refetch
  }
}
