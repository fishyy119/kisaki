<!--
Browse Extension Filter Bar controls catalog search and repository filters.
Boundary: owns filter inputs, while results are fetched by the panel.
-->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
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
import { useDebouncedRef } from '@renderer/composables/use-debounced-ref'
import { useDiscoverExtensionStore, type DiscoverExtensionSortField } from '../../stores'
import { EXTENSION_CATEGORIES } from '../../types'
import type { ExtensionCategory } from '@kisaki3/extension-api'

// Category icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  scraper: 'icon-[mdi--database-outline]',
  tool: 'icon-[mdi--wrench-outline]',
  theme: 'icon-[mdi--palette-outline]',
  integration: 'icon-[mdi--connection]'
}

const SORT_OPTIONS: { value: DiscoverExtensionSortField; label: string }[] = [
  { value: 'relevance', label: '相关' },
  { value: 'name', label: '名称' },
  { value: 'publishedAt', label: '发布' },
  { value: 'updatedAt', label: '更新' },
  { value: 'repositoryPriority', label: '仓库' }
]

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

// Debounced search: auto-trigger search when input changes
const debouncedSearchInput = useDebouncedRef(() => store.searchInput, 300)

// Trigger search when debounced value changes
watch(debouncedSearchInput, () => {
  store.triggerSearch()
})

// Computed models for v-model binding
const searchInputModel = computed({
  get: () => store.searchInput,
  set: (v: string | number | undefined) => store.setSearchInput(String(v ?? ''))
})

const sortFieldModel = computed({
  get: () => store.sortField,
  set: (v: DiscoverExtensionSortField) => store.setSortField(v)
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

function handleToggleSortDirection() {
  store.setSortDirection(store.sortDirection === 'desc' ? 'asc' : 'desc')
}
</script>

<template>
  <div class="shrink-0 flex flex-col gap-3 px-4 py-3 border-b border-border bg-muted/50">
    <!-- Top row: Search + Repository + Sort -->
    <div class="flex items-center gap-3">
      <!-- Search input with button -->
      <div class="flex items-center gap-2 flex-1 max-w-xl">
        <InputGroup class="flex-1">
          <InputGroupAddon>
            <Icon
              icon="icon-[mdi--magnify]"
              class="size-4"
            />
          </InputGroupAddon>
          <InputGroupInput
            v-model="searchInputModel"
            class="text-xs"
            placeholder="搜索扩展名称或描述..."
          />
          <InputGroupAddon
            v-if="store.searchInput"
            class="cursor-pointer"
            align="inline-end"
            @click="store.clearSearch"
          >
            <Icon
              icon="icon-[mdi--close]"
              class="size-4 text-muted-foreground hover:text-foreground"
            />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <!-- Spacer -->
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
          <SelectValue class="leading-none" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部仓库</SelectItem>
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
          {{ store.compatibleOnly ? '仅显示兼容版本' : '显示全部兼容状态' }}
        </TooltipContent>
      </Tooltip>

      <!-- Sort controls: Select + Direction toggle -->
      <ButtonGroup>
        <Select v-model="sortFieldModel">
          <SelectTrigger
            size="sm"
            class="border-r-0 focus:border-border"
          >
            <SelectValue class="leading-none" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in SORT_OPTIONS"
              :key="option.value"
              :value="option.value"
              class="leading-none"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-sm"
              @click="handleToggleSortDirection"
            >
              <Icon
                :icon="
                  store.sortDirection === 'asc'
                    ? 'icon-[mdi--sort-ascending]'
                    : 'icon-[mdi--sort-descending]'
                "
                class="size-4 transition-transform"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{ store.sortDirection === 'asc' ? '升序' : '降序' }}
          </TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </div>

    <!-- Bottom row: Category filter -->
    <SegmentedControl v-model="categoryModel">
      <SegmentedControlItem value="all">
        <Icon
          icon="icon-[mdi--view-grid-outline]"
          class="size-3.5"
        />
        全部
      </SegmentedControlItem>
      <SegmentedControlItem
        v-for="cat in EXTENSION_CATEGORIES"
        :key="cat.id"
        :value="cat.id"
      >
        <Icon
          :icon="CATEGORY_ICONS[cat.id]"
          class="size-3.5"
        />
        {{ cat.label }}
      </SegmentedControlItem>
    </SegmentedControl>
  </div>
</template>
