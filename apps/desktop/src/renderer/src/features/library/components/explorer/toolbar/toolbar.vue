<!--
  ExplorerToolbar
  Navigation row above the explorer band: the type switch on the scope row,
  search / sort / filter on the query row, all over the store's one
  EntityListQuery. The rail sits under the band's label threshold, so the
  tabs collapse to icons and the sort control takes its compact form.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { SearchInput } from '@renderer/components/ui/search-input'
import { SortControl, type SortOption } from '@renderer/components/ui/sort-control'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import { EntityBrowseTabs } from '@renderer/components/shared/entity'
import { FilterTrigger, getFilterUiSpec } from '@renderer/components/shared/filter'
import { switchEntityListType } from '@renderer/composables/entity-list-query'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/entity-types'
import type { SortDirection } from '@shared/filter'
import { MEMBERSHIP_SORT_KEY, type FilterState } from '@shared/filter'
import { useLibraryExplorerStore } from '../../../stores'
import LibraryExplorerToolbarNav from './toolbar-nav.vue'

const { m } = useI18n()

const store = useLibraryExplorerStore()
const { query, activeEntityType } = storeToRefs(store)

const uiSpec = computed(() => getFilterUiSpec(activeEntityType.value).value)

const sortOptions = computed<SortOption[]>(() => [
  {
    value: MEMBERSHIP_SORT_KEY,
    label: m.value.library.browse.membershipOrder.collection,
    directionFixed: true
  },
  ...uiSpec.value.sortOptions.map((option) => ({
    value: option.key,
    label: option.label,
    directionFixed: option.directionFixed
  }))
])

const entityTypeModel = computed({
  get: () => activeEntityType.value,
  set: (entityType: ContentEntityType) => {
    store.setQuery(switchEntityListType(query.value, entityType))
  }
})

const searchModel = computed({
  get: () => query.value.search,
  set: (search: string) => store.setQuery({ ...query.value, search })
})

const filterModel = computed({
  get: () => query.value.filter,
  set: (filter: FilterState) => store.setQuery({ ...query.value, filter })
})

const sortFieldModel = computed({
  get: () => query.value.sort.key,
  set: (key: string) => store.setQuery({ ...query.value, sort: { ...query.value.sort, key } })
})

const sortDirectionModel = computed({
  get: () => query.value.sort.direction,
  set: (direction: SortDirection) =>
    store.setQuery({ ...query.value, sort: { ...query.value.sort, direction } })
})
</script>

<template>
  <div class="shrink-0">
    <div class="flex h-12 items-center justify-between border-b px-2 py-1.5">
      <LibraryExplorerToolbarNav />
    </div>

    <Toolbar class="px-2">
      <ToolbarRow>
        <EntityBrowseTabs v-model="entityTypeModel" />
      </ToolbarRow>

      <ToolbarRow class="gap-1.5">
        <!-- Keyed by type: a type switch replaces the instance, so a draft
             pending inside the debounce window cannot leak into the new type -->
        <SearchInput
          :key="activeEntityType"
          v-model="searchModel"
          size="sm"
          class="flex-1"
        />
        <SortControl
          v-model:field="sortFieldModel"
          v-model:direction="sortDirectionModel"
          :options="sortOptions"
          compact
          size="sm"
        />
        <FilterTrigger
          v-model="filterModel"
          :ui-spec="uiSpec"
          side="right"
          align="start"
        />
      </ToolbarRow>
    </Toolbar>
  </div>
</template>
