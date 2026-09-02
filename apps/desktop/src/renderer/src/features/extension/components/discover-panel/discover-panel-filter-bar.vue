<!--
Browse Extension Filter Bar is the discover band: the category scope row,
then the query row with search, repository, compatibility, and sort.
Boundary: owns filter inputs, while results are fetched by the panel.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { SearchInput } from '@renderer/components/ui/search-input'
import { SortControl, type SortOption } from '@renderer/components/ui/sort-control'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils/cn'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { useI18n } from '@renderer/composables/use-i18n'
import { useDiscoverExtensionStore, type DiscoverExtensionSortField } from '../../stores'
import { EXTENSION_CATEGORIES } from '../../types'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/filter'

// Category icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  scraper: 'icon-[mdi--database-outline]',
  tool: 'icon-[mdi--wrench-outline]',
  theme: 'icon-[mdi--palette-outline]',
  integration: 'icon-[mdi--connection]'
}

const { m } = useI18n()

const SORT_OPTIONS = computed<SortOption<DiscoverExtensionSortField>[]>(() => [
  { value: 'relevance', label: m.value.extension.discover.sortRelevance },
  { value: 'name', label: m.value.extension.discover.sortName },
  { value: 'publishedAt', label: m.value.extension.discover.sortPublishedAt },
  { value: 'updatedAt', label: m.value.extension.discover.sortUpdatedAt },
  { value: 'repositoryPriority', label: m.value.extension.discover.sortRepositoryPriority }
])

const store = useDiscoverExtensionStore()

const { data: repositories } = useAsyncData(
  async () => {
    return unwrapIpcData(await ipcManager.invoke('extension:list-repositories'))
  },
  { immediate: true }
)

const repositoriesList = computed(() => repositories.value ?? [])
const enabledRepositories = computed(() =>
  repositoriesList.value.filter((repository) => repository.state === 'enabled')
)

// The search input debounces; every model change is already a committed query
const searchModel = computed({
  get: () => store.searchQuery,
  set: (value: string) => store.setSearchQuery(value)
})

const sortFieldModel = computed({
  get: () => store.sortField,
  set: (value: DiscoverExtensionSortField) => store.setSortField(value)
})

const sortDirectionModel = computed({
  get: () => store.sortDirection,
  set: (value: SortDirection) => store.setSortDirection(value)
})

const categoryModel = computed({
  get: () => store.selectedCategory ?? 'all',
  set: (value: string) =>
    store.setSelectedCategory(value === 'all' ? null : (value as ExtensionCategory))
})

const repositoryModel = computed({
  get: () => store.selectedRepositoryId ?? 'all',
  set: (value: string) => store.setSelectedRepositoryId(value === 'all' ? null : value)
})
</script>

<template>
  <Toolbar>
    <ToolbarRow>
      <SegmentedControl v-model="categoryModel">
        <SegmentedControlItem value="all">
          <Icon
            icon="icon-[mdi--view-grid-outline]"
            class="size-3.5"
          />
          {{ m.extension.discover.allCategories }}
        </SegmentedControlItem>
        <SegmentedControlItem
          v-for="cat in EXTENSION_CATEGORIES"
          :key="cat.id"
          :value="cat.id"
        >
          <Icon
            :icon="CATEGORY_ICONS[cat.id]!"
            class="size-3.5"
          />
          {{ cat.label }}
        </SegmentedControlItem>
      </SegmentedControl>
    </ToolbarRow>

    <ToolbarRow>
      <SearchInput
        v-model="searchModel"
        :placeholder="m.extension.discover.searchPlaceholder"
        size="sm"
        class="max-w-xl flex-1"
      />

      <div class="flex-1" />

      <!-- Repository selector -->
      <Select v-model="repositoryModel">
        <SelectTrigger
          size="sm"
          class="min-w-40"
        >
          <Icon
            icon="icon-[mdi--source-branch]"
            class="size-4 text-muted-foreground"
          />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ m.extension.discover.allRepositories }}</SelectItem>
          <SelectItem
            v-for="repository in enabledRepositories"
            :key="repository.id"
            :value="repository.id"
          >
            {{ repository.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            :variant="store.compatibleOnly ? 'secondary' : 'outline'"
            size="icon-sm"
            :class="cn(!store.compatibleOnly && 'text-muted-foreground')"
            @click="store.setCompatibleOnly(!store.compatibleOnly)"
          >
            <Icon
              icon="icon-[mdi--shield-check-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {{
            store.compatibleOnly
              ? m.extension.discover.compatibleOnly
              : m.extension.discover.allCompatibility
          }}
        </TooltipContent>
      </Tooltip>

      <SortControl
        v-model:field="sortFieldModel"
        v-model:direction="sortDirectionModel"
        :options="SORT_OPTIONS"
        size="sm"
      />
    </ToolbarRow>
  </Toolbar>
</template>
