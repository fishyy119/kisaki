<!--
Installed Extension Filter Bar controls installed extension filters.
Boundary: updates store state, emits installed panel actions, and does not fetch catalog data.
-->
<script setup lang="ts">
import { computed } from 'vue'
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
import { useI18n } from '@renderer/composables/use-i18n'
import {
  useInstalledExtensionStore,
  type InstalledExtensionSortField,
  type InstalledExtensionStatusFilter
} from '../../stores'
import { EXTENSION_CATEGORIES } from '../../types'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { ExtensionAutomaticUpdateRunState } from '@shared/extension'

interface Props {
  updateCount?: number
  checkingUpdates?: boolean
  automaticUpdateRun?: ExtensionAutomaticUpdateRunState | null
}

interface Emits {
  (e: 'checkUpdates'): void
}

const props = withDefaults(defineProps<Props>(), {
  updateCount: 0,
  checkingUpdates: false,
  automaticUpdateRun: null
})
const emit = defineEmits<Emits>()

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

const SORT_OPTIONS = computed<{ value: InstalledExtensionSortField; label: string }[]>(() => [
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
const searchQueryModel = computed({
  get: () => store.searchQuery,
  set: (v: string | number | undefined) => store.setSearchQuery(String(v ?? ''))
})

const sortFieldModel = computed({
  get: () => store.sortField,
  set: (v: InstalledExtensionSortField) => store.setSortField(v)
})

const categoryModel = computed({
  get: () => store.selectedCategory ?? 'all',
  set: (value: string) =>
    store.setSelectedCategory(value === 'all' ? null : (value as ExtensionCategory))
})

const automaticUpdateSummary = computed(() => {
  const run = props.automaticUpdateRun
  if (!run || run.status === 'idle') {
    return null
  }

  if (run.status === 'running') {
    return m.value.extension.installed.startupUpdating
  }

  const updated = run.results.filter((result) => result.status === 'updated').length
  const failed = run.results.filter((result) => result.status === 'failed').length
  if (updated === 0 && failed === 0) {
    return run.repositoryRefreshError ? m.value.extension.installed.repositoryRefreshFailed : null
  }
  if (failed > 0) {
    return m.value.extension.installed.autoUpdateFailedCount({ count: failed })
  }

  return null
})

const automaticUpdateIcon = computed(() => {
  if (props.automaticUpdateRun?.status === 'running') {
    return 'icon-[mdi--refresh]'
  }

  return props.automaticUpdateRun?.results.some((result) => result.status === 'failed') ||
    props.automaticUpdateRun?.repositoryRefreshError
    ? 'icon-[mdi--alert-circle-outline]'
    : 'icon-[mdi--check-circle-outline]'
})

function handleClearSearch() {
  store.setSearchQuery('')
}

function handleToggleSortDirection() {
  store.setSortDirection(store.sortDirection === 'desc' ? 'asc' : 'desc')
}
</script>

<template>
  <div class="shrink-0 flex flex-col gap-3 px-4 py-3 border-b border-border bg-muted/50">
    <!-- Top row: Search + Status + Updates + Sort -->
    <div class="flex items-center gap-3">
      <!-- Search input -->
      <InputGroup class="flex-1 max-w-xl">
        <InputGroupAddon>
          <Icon
            icon="icon-[mdi--magnify]"
            class="size-4"
          />
        </InputGroupAddon>
        <InputGroupInput
          v-model="searchQueryModel"
          :placeholder="m.extension.installed.searchPlaceholder"
        />
        <InputGroupAddon
          v-if="store.searchQuery"
          class="cursor-pointer"
          align="inline-end"
          @click="handleClearSearch"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-4 text-muted-foreground hover:text-foreground"
          />
        </InputGroupAddon>
      </InputGroup>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Update actions -->
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="props.checkingUpdates"
          @click="emit('checkUpdates')"
        >
          <Icon
            icon="icon-[mdi--refresh]"
            :class="cn('size-4', props.checkingUpdates && 'animate-spin')"
          />
          {{ m.extension.installed.checkUpdates }}
        </Button>

        <div
          v-if="automaticUpdateSummary"
          class="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Icon
            :icon="automaticUpdateIcon"
            :class="
              cn(
                'size-3.5',
                props.automaticUpdateRun?.status === 'running' && 'animate-spin',
                props.automaticUpdateRun?.results.some((result) => result.status === 'failed') &&
                  'text-destructive',
                props.automaticUpdateRun?.repositoryRefreshError && 'text-destructive'
              )
            "
          />
          <span>{{ automaticUpdateSummary }}</span>
        </div>
      </div>

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
              v-if="props.updateCount > 0"
              :class="
                cn(
                  'text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center',
                  store.showUpdatesOnly
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20'
                )
              "
            >
              {{ props.updateCount }}
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
            {{
              store.sortDirection === 'asc'
                ? m.extension.installed.ascending
                : m.extension.installed.descending
            }}
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
  </div>
</template>
