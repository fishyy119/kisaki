<!--
Active Task Run Toolbar renders the running tab's query row: search, hit
count, then the category and status filters. It is a row inside the
task-center band; the dialog owns the band chrome.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import type { TaskRunCategoryFilter, TaskRunStatusFilter } from '../../../types'
import { SearchInput } from '@renderer/components/ui/search-input'
import { ToolbarRow } from '@renderer/components/ui/toolbar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  TASK_RUN_ACTIVE_STATUS_OPTIONS,
  TASK_RUN_CATEGORY_OPTIONS,
  formatTaskRunCategory,
  formatTaskRunStatus
} from '../../../utils/display'

interface Props {
  filteredCount: number
}

const props = defineProps<Props>()

const { m } = useI18n()

const search = defineModel<string>('search', { required: true })
const category = defineModel<TaskRunCategoryFilter>('category', { required: true })
const status = defineModel<TaskRunStatusFilter>('status', { required: true })

const isQueryActive = computed(
  () => search.value.trim().length > 0 || category.value !== 'all' || status.value !== 'all'
)
</script>

<template>
  <ToolbarRow>
    <SearchInput
      v-model="search"
      :placeholder="m.task.toolbar.searchActivePlaceholder"
      size="sm"
      class="max-w-xl flex-1"
    />
    <span
      v-if="isQueryActive"
      class="shrink-0 text-xs text-muted-foreground"
    >
      {{ m.common.itemCount({ count: props.filteredCount }) }}
    </span>

    <div class="flex-1" />

    <Select v-model="category">
      <SelectTrigger
        size="sm"
        class="w-28"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{{ m.task.toolbar.allCategories }}</SelectItem>
        <SelectItem
          v-for="item in TASK_RUN_CATEGORY_OPTIONS"
          :key="item"
          :value="item"
        >
          {{ formatTaskRunCategory(item) }}
        </SelectItem>
      </SelectContent>
    </Select>

    <Select v-model="status">
      <SelectTrigger
        size="sm"
        class="w-28"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{{ m.task.toolbar.allStatuses }}</SelectItem>
        <SelectItem
          v-for="item in TASK_RUN_ACTIVE_STATUS_OPTIONS"
          :key="item"
          :value="item"
        >
          {{ formatTaskRunStatus(item) }}
        </SelectItem>
      </SelectContent>
    </Select>
  </ToolbarRow>
</template>
