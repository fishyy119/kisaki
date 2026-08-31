<!--
Active Task Run Toolbar renders the running tab's filter controls. It is a
row inside the task-center band strip; the dialog owns the band chrome.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import type { TaskRunCategoryFilter, TaskRunStatusFilter } from '../../../types'
import { Icon } from '@renderer/components/ui/icon'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
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

const hasSearch = computed(() => search.value.trim().length > 0)

function clearSearch(): void {
  search.value = ''
}
</script>

<template>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-3">
      <div class="min-w-2 flex-1" />

      <InputGroup class="max-w-64 flex-1">
        <InputGroupAddon>
          <Icon
            icon="icon-[mdi--magnify]"
            class="size-4"
          />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          :placeholder="m.task.toolbar.searchActivePlaceholder"
        />
        <InputGroupAddon
          v-if="hasSearch"
          align="inline-end"
          class="cursor-pointer"
          @click="clearSearch"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-4 text-muted-foreground hover:text-foreground"
          />
        </InputGroupAddon>
      </InputGroup>

      <span
        v-if="hasSearch"
        class="shrink-0 text-xs text-muted-foreground"
      >
        {{ m.common.itemCount({ count: props.filteredCount }) }}
      </span>

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
    </div>
  </div>
</template>
