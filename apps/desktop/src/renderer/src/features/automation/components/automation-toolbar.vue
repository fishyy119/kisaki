<!--
Automation Toolbar
The band's single query row: search and hit count, then the status button
group, source select, and sort control.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils/cn'
import { useI18n } from '@renderer/composables/use-i18n'
import type { SortDirection } from '@shared/filter'
import type { AutomationSortField, AutomationSourceFilter, AutomationStatusFilter } from '../types'

interface Props {
  filteredCount: number
}

const props = defineProps<Props>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const statusFilter = defineModel<AutomationStatusFilter>('statusFilter', { required: true })
const sourceFilter = defineModel<AutomationSourceFilter>('sourceFilter', { required: true })
const sortField = defineModel<AutomationSortField>('sortField', { required: true })
const sortDirection = defineModel<SortDirection>('sortDirection', { required: true })

const { m } = useI18n()

const statusOptions = computed<
  {
    value: AutomationStatusFilter
    label: string
    icon: string
  }[]
>(() => [
  { value: 'all', label: m.value.automation.toolbar.filterAll, icon: 'icon-[mdi--filter-outline]' },
  {
    value: 'enabled',
    label: m.value.automation.toolbar.filterEnabled,
    icon: 'icon-[mdi--check-circle-outline]'
  },
  {
    value: 'disabled',
    label: m.value.automation.toolbar.filterDisabled,
    icon: 'icon-[mdi--pause-circle-outline]'
  },
  {
    value: 'running',
    label: m.value.automation.toolbar.filterRunning,
    icon: 'icon-[mdi--progress-clock]'
  },
  {
    value: 'failed',
    label: m.value.automation.toolbar.filterFailed,
    icon: 'icon-[mdi--alert-circle-outline]'
  }
])

const sortOptions = computed<SortOption<AutomationSortField>[]>(() => [
  { value: 'createdAt', label: m.value.automation.toolbar.sortCreatedAt },
  { value: 'name', label: m.value.automation.toolbar.sortName },
  { value: 'lastRunAt', label: m.value.automation.toolbar.sortLastRunAt },
  { value: 'nextRunAt', label: m.value.automation.toolbar.sortNextRunAt }
])

const sourceOptions = computed<{ value: AutomationSourceFilter; label: string }[]>(() => [
  { value: 'all', label: m.value.automation.toolbar.sourceAll },
  { value: 'app', label: m.value.automation.toolbar.sourceApp },
  { value: 'extension', label: m.value.automation.toolbar.sourceExtension }
])

const isQueryActive = computed(
  () =>
    searchQuery.value.trim().length > 0 ||
    statusFilter.value !== 'all' ||
    sourceFilter.value !== 'all'
)
</script>

<template>
  <Toolbar>
    <ToolbarRow>
      <SearchInput
        v-model="searchQuery"
        :placeholder="m.automation.toolbar.searchPlaceholder"
        size="sm"
        class="max-w-xl flex-1"
      />
      <span
        v-if="isQueryActive"
        class="shrink-0 text-xs text-muted-foreground"
      >
        {{ m.values.itemCount({ count: props.filteredCount }) }}
      </span>

      <template #trailing>
        <ButtonGroup>
          <template
            v-for="option in statusOptions"
            :key="option.value"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  :variant="statusFilter === option.value ? 'secondary' : 'outline'"
                  size="icon-sm"
                  :class="cn(statusFilter !== option.value && 'text-muted-foreground')"
                  @click="statusFilter = option.value"
                >
                  <Icon
                    :icon="option.icon"
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{{ option.label }}</TooltipContent>
            </Tooltip>
          </template>
        </ButtonGroup>

        <Select v-model="sourceFilter">
          <SelectTrigger
            size="sm"
            class="w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in sourceOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <SortControl
          v-model:field="sortField"
          v-model:direction="sortDirection"
          :options="sortOptions"
          size="sm"
        />
      </template>
    </ToolbarRow>
  </Toolbar>
</template>
