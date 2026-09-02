<!--
  EntityBrowseToolbar
  Band of a content entity browse surface over one EntityListQuery: the type
  switch on the scope row; search, hit count, sort, and filter on the query
  row. Switching type resets the type-bound parts of the query.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { SearchInput } from '@renderer/components/ui/search-input'
import { SortControl, type SortOption } from '@renderer/components/ui/sort-control'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import { FilterTrigger, getFilterUiSpec } from '@renderer/components/shared/filter'
import type { ContentEntityCounts } from '@renderer/composables/content-entities'
import {
  hasActiveEntityListQuery,
  switchEntityListType,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/entity-types'
import type { SortDirection } from '@shared/filter'
import { MEMBERSHIP_SORT_KEY, type FilterState } from '@shared/filter'
import EntityBrowseTabs from './browse-tabs.vue'

interface Props {
  /** Type being shown; the query only carries the request. */
  entityType: ContentEntityType
  counts: ContentEntityCounts
  disabledTypes?: readonly ContentEntityType[]
  /** Label of the scope's own order, the first sort option. */
  membershipLabel: string
  /** Rows the active query matched; shown while a query is active. */
  filteredCount: number
}

const props = withDefaults(defineProps<Props>(), {
  disabledTypes: () => []
})

const query = defineModel<EntityListQuery>('query', { required: true })

const { m } = useI18n()

const uiSpec = computed(() => getFilterUiSpec(props.entityType).value)

const sortOptions = computed<SortOption[]>(() => [
  { value: MEMBERSHIP_SORT_KEY, label: props.membershipLabel, directionFixed: true },
  ...uiSpec.value.sortOptions.map((option) => ({
    value: option.key,
    label: option.label,
    directionFixed: option.directionFixed
  }))
])

const isQueryActive = computed(() => hasActiveEntityListQuery(query.value))

const entityTypeModel = computed({
  get: () => props.entityType,
  set: (entityType: ContentEntityType) => {
    query.value = switchEntityListType(query.value, entityType)
  }
})

const searchModel = computed({
  get: () => query.value.search,
  set: (search: string) => {
    query.value = { ...query.value, search }
  }
})

const filterModel = computed({
  get: () => query.value.filter,
  set: (filter: FilterState) => {
    query.value = { ...query.value, filter }
  }
})

const sortFieldModel = computed({
  get: () => query.value.sort.key,
  set: (key: string) => {
    query.value = { ...query.value, sort: { ...query.value.sort, key } }
  }
})

const sortDirectionModel = computed({
  get: () => query.value.sort.direction,
  set: (direction: SortDirection) => {
    query.value = { ...query.value, sort: { ...query.value.sort, direction } }
  }
})
</script>

<template>
  <Toolbar>
    <ToolbarRow>
      <EntityBrowseTabs
        v-model="entityTypeModel"
        :counts="props.counts"
        :disabled-types="props.disabledTypes"
      />
    </ToolbarRow>

    <ToolbarRow>
      <!-- Keyed by type: a type switch replaces the instance, so a draft
           pending inside the debounce window cannot leak into the new type -->
      <SearchInput
        :key="props.entityType"
        v-model="searchModel"
        size="sm"
        class="max-w-xl flex-1"
      />
      <span
        v-if="isQueryActive"
        class="shrink-0 text-xs text-muted-foreground"
      >
        {{ m.values.itemCount({ count: props.filteredCount }) }}
      </span>

      <div class="flex-1" />

      <SortControl
        v-model:field="sortFieldModel"
        v-model:direction="sortDirectionModel"
        :options="sortOptions"
        size="sm"
      />
      <FilterTrigger
        v-model="filterModel"
        :ui-spec="uiSpec"
      />
    </ToolbarRow>
  </Toolbar>
</template>
