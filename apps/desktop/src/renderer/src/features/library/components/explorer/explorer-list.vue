<script setup lang="ts">
/**
 * ExplorerList - Entity list with collection grouping
 *
 * Displays entities grouped by collection, with collapsible groups.
 * Uses virtualization for filter mode flat list.
 */

import { computed, provide, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualList } from '@renderer/components/ui/virtual'
import { useRenderState } from '@renderer/composables'
import { useDefaultFromStore } from '@renderer/stores'
import { getEntityIcon } from '@renderer/utils/format'
import { formatExplorerContext } from '@renderer/utils/explorer-context'
import { useLibraryExplorerStore } from '../../stores'
import {
  useExplorerList,
  useExplorerLocator,
  FILTERED_LIST_VIEW_ID,
  UNCATEGORIZED_GROUP_ID,
  type ExplorerListViewHandle
} from '../../composables'
import LibraryExplorerGroup from './explorer-group.vue'
import LibraryExplorerListItem from './explorer-list-item.vue'
import { hasActiveEntityListQuery } from '@renderer/composables/entity-list-query'
import { toExplorerSelectionKey } from '../../utils/explorer-selection'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const UNCATEGORIZED_FROM = formatExplorerContext({ kind: 'uncategorized' })

function toCollectionFrom(collectionId: string): string {
  return formatExplorerContext({ kind: 'collection', collectionId })
}

const store = useLibraryExplorerStore()
const defaultFromStore = useDefaultFromStore()
const { activeEntityType, query, collapsedIds } = storeToRefs(store)
const { data, rawData, allEntities, isLoading } = useExplorerList()
const locator = useExplorerLocator()
const state = useRenderState(isLoading, null, rawData)

const isFiltering = computed(() => hasActiveEntityListQuery(query.value))

const hasData = computed(
  () => data.value.collections.length > 0 || data.value.uncategorized.length > 0
)

watch(isFiltering, (value, oldValue) => {
  if (value === oldValue) return
  store.clearSelection()
})

// The filter-mode flat list is a scroll target of the locator too
const filteredListView = useTemplateRef<ExplorerListViewHandle>('filteredListView')

watch(filteredListView, (view, _previous, onCleanup) => {
  if (!view) return
  onCleanup(locator.registerListView(FILTERED_LIST_VIEW_ID, view))
})

const visibleSelectionKeys = computed(() => {
  if (isFiltering.value) {
    return allEntities.value.map((e) => {
      const from = defaultFromStore.getFrom(activeEntityType.value, e.id)
      return toExplorerSelectionKey(from, e.id)
    })
  }

  const keys: string[] = []
  for (const group of data.value.collections) {
    if (collapsedIds.value.includes(group.id)) continue
    const from = toCollectionFrom(group.id)
    keys.push(...group.entities.map((e) => toExplorerSelectionKey(from, e.id)))
  }

  if (!collapsedIds.value.includes(UNCATEGORIZED_GROUP_ID)) {
    keys.push(
      ...data.value.uncategorized.map((e) => toExplorerSelectionKey(UNCATEGORIZED_FROM, e.id))
    )
  }

  return keys
})

provide('explorerVisibleSelectionKeys', visibleSelectionKeys)

const allKnownSelectionKeys = computed(() => {
  const keys = new Set<string>()

  // Grouped view instances (including collapsed groups).
  for (const group of data.value.collections) {
    const from = toCollectionFrom(group.id)
    for (const entity of group.entities) {
      keys.add(toExplorerSelectionKey(from, entity.id))
    }
  }
  for (const entity of data.value.uncategorized) {
    keys.add(toExplorerSelectionKey(UNCATEGORIZED_FROM, entity.id))
  }

  // Filter view instances (stable key space).
  for (const entity of allEntities.value) {
    const from = defaultFromStore.getFrom(activeEntityType.value, entity.id)
    keys.add(toExplorerSelectionKey(from, entity.id))
  }

  return keys
})

watch(
  allKnownSelectionKeys,
  (allowedKeys) => {
    store.pruneSelection(allowedKeys)
  },
  { immediate: true }
)

const currentConfig = computed(() => ({
  icon: getEntityIcon(activeEntityType.value),
  label: m.value.library.entities[activeEntityType.value]
}))
</script>

<template>
  <!-- Loading state -->
  <StateView
    v-if="state === 'loading'"
    state="loading"
    size="sm"
    class="py-8"
  />

  <!-- Success state -->
  <template v-else-if="state === 'success'">
    <!-- Filter mode: virtualized flat list -->
    <div
      v-if="isFiltering"
      class="py-1 pr-1"
    >
      <div
        class="flex items-center h-6 px-2 text-xs text-muted-foreground/70 rounded-r-md bg-accent/20 mb-0.5"
      >
        {{ m.library.explorer.filteredResults }}
        <span class="ml-auto tabular-nums opacity-50">{{ allEntities.length }}</span>
      </div>
      <VirtualList
        v-if="allEntities.length > 0"
        ref="filteredListView"
        :items="allEntities"
        scroll-parent="region"
        class="flex flex-col gap-0.5"
      >
        <template #item="{ item }">
          <LibraryExplorerListItem
            :entity="item"
            :entity-type="activeEntityType"
            :from="defaultFromStore.getFrom(activeEntityType, item.id)"
          />
        </template>
      </VirtualList>
      <!-- Empty filter results -->
      <StateView
        v-else
        state="empty"
        size="sm"
        icon="icon-[mdi--filter-off-outline]"
        :description="m.library.explorer.noMatch"
        class="py-10"
      />
    </div>

    <!-- Empty state -->
    <StateView
      v-else-if="!hasData"
      state="empty"
      size="sm"
      :icon="currentConfig.icon"
      :description="m.library.explorer.emptyList({ label: currentConfig.label })"
      class="py-10"
    />

    <!-- Normal grouped view -->
    <div
      v-else
      class="py-1 pr-1"
    >
      <!-- Collection groups -->
      <LibraryExplorerGroup
        v-for="group in data.collections"
        :key="group.id"
        :group="group"
        :entity-type="activeEntityType"
      />

      <!-- Uncategorized -->
      <LibraryExplorerGroup
        v-if="data.uncategorized.length > 0"
        :group="{
          id: UNCATEGORIZED_GROUP_ID,
          name: m.library.explorer.uncategorized,
          coverFile: null,
          isDynamic: false,
          entities: data.uncategorized
        }"
        :entity-type="activeEntityType"
        is-uncategorized
      />
    </div>
  </template>
</template>
