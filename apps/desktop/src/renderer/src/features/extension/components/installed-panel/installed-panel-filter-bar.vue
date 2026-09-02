<!--
Installed Extension Filter Bar is the installed band: the category scope row,
then the query row with search, status, the updates-only toggle, and sort.
Boundary: updates store state and does not fetch catalog data.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
import { SearchInput } from '@renderer/components/ui/search-input'
import { SortControl, type SortOption } from '@renderer/components/ui/sort-control'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils/cn'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  useInstalledExtensionStore,
  type InstalledExtensionSortField,
  type InstalledExtensionStatusFilter
} from '../../stores'
import { EXTENSION_CATEGORIES } from '../../types'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/filter'

const { m } = useI18n()

// Status filter configuration
const STATUS_OPTIONS = computed<
  { value: InstalledExtensionStatusFilter; label: string; icon: string }[]
>(() => [
  {
    value: 'all',
    label: m.value.extension.installed.filterAll,
    icon: 'icon-[mdi--filter-outline]'
  },
  {
    value: 'enabled',
    label: m.value.extension.installed.filterEnabled,
    icon: 'icon-[mdi--check-circle-outline]'
  },
  {
    value: 'disabled',
    label: m.value.extension.installed.filterDisabled,
    icon: 'icon-[mdi--pause-circle-outline]'
  }
])

const SORT_OPTIONS = computed<SortOption<InstalledExtensionSortField>[]>(() => [
  { value: 'name', label: m.value.extension.installed.sortName },
  { value: 'status', label: m.value.extension.installed.sortStatus },
  { value: 'hasUpdate', label: m.value.extension.installed.sortHasUpdate }
])

// Category icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  scraper: 'icon-[mdi--database-outline]',
  tool: 'icon-[mdi--wrench-outline]',
  theme: 'icon-[mdi--palette-outline]',
  integration: 'icon-[mdi--connection]'
}

const store = useInstalledExtensionStore()

// Computed models for v-model binding
const searchModel = computed({
  get: () => store.searchQuery,
  set: (value: string) => store.setSearchQuery(value)
})

const sortFieldModel = computed({
  get: () => store.sortField,
  set: (value: InstalledExtensionSortField) => store.setSortField(value)
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
          {{ m.extension.installed.filterAll }}
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
        :placeholder="m.extension.installed.searchPlaceholder"
        size="sm"
        class="max-w-xl flex-1"
      />

      <div class="flex-1" />

      <!-- Status filter as button group -->
      <ButtonGroup>
        <template
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                :variant="store.statusFilter === opt.value ? 'secondary' : 'outline'"
                size="icon-sm"
                :class="cn(store.statusFilter !== opt.value && 'text-muted-foreground')"
                @click="store.setStatusFilter(opt.value)"
              >
                <Icon
                  :icon="opt.icon"
                  class="size-4"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{{ opt.label }}</TooltipContent>
          </Tooltip>
        </template>
      </ButtonGroup>

      <!-- Updates filter toggle -->
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            :variant="store.showUpdatesOnly ? 'secondary' : 'outline'"
            size="sm"
            :class="cn('gap-1.5', !store.showUpdatesOnly && 'text-muted-foreground')"
            @click="store.setShowUpdatesOnly(!store.showUpdatesOnly)"
          >
            <Icon
              icon="icon-[mdi--refresh]"
              class="size-4"
            />
            <span
              v-if="store.updates.length > 0"
              :class="
                cn(
                  'text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center',
                  store.showUpdatesOnly
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20'
                )
              "
            >
              {{ store.updates.length }}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {{
            store.showUpdatesOnly
              ? m.extension.installed.showAll
              : m.extension.installed.showUpdatesOnly
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
