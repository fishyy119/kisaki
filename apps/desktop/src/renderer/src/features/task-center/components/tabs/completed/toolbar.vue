<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import type { TaskRunCategoryFilter, TaskRunStatusFilter } from '../../../types'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  TASK_RUN_CATEGORY_OPTIONS,
  TASK_RUN_COMPLETED_STATUS_OPTIONS,
  formatTaskRunCategory,
  formatTaskRunStatus
} from '../../../utils/display'

interface Props {
  filteredCount: number
  completedCount: number
  refreshing?: boolean
  clearing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  refreshing: false,
  clearing: false
})

const { m } = useI18n()

const search = defineModel<string>('search', { required: true })
const category = defineModel<TaskRunCategoryFilter>('category', { required: true })
const status = defineModel<TaskRunStatusFilter>('status', { required: true })

const emit = defineEmits<{
  refresh: []
  clearCompleted: []
}>()

const hasSearch = computed(() => search.value.trim().length > 0)

function clearSearch(): void {
  search.value = ''
}
</script>

<template>
  <div class="shrink-0 border-b border-border bg-muted/50 px-4 py-2">
    <div class="flex items-center gap-3">
      <InputGroup class="max-w-md flex-1">
        <InputGroupAddon>
          <Icon
            icon="icon-[mdi--magnify]"
            class="size-4"
          />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          class="text-xs"
          :placeholder="m.task.toolbar.searchCompletedPlaceholder"
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

      <div
        v-if="props.refreshing"
        class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Spinner class="size-3.5" />
        <span>{{ m.task.toolbar.refreshing }}</span>
      </div>

      <div class="min-w-2 flex-1" />

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
            v-for="item in TASK_RUN_COMPLETED_STATUS_OPTIONS"
            :key="item"
            :value="item"
          >
            {{ formatTaskRunStatus(item) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <ButtonGroup>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-sm"
              :disabled="props.refreshing"
              :aria-label="m.task.toolbar.refreshList"
              @click="emit('refresh')"
            >
              <Icon
                icon="icon-[mdi--refresh]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{{ m.task.toolbar.refresh }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-sm"
              :disabled="props.completedCount === 0 || props.clearing"
              :aria-label="m.task.toolbar.clearCompleted"
              @click="emit('clearCompleted')"
            >
              <Icon
                icon="icon-[mdi--trash-can-outline]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{{ m.task.toolbar.clearCompleted }}</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </div>
  </div>
</template>
