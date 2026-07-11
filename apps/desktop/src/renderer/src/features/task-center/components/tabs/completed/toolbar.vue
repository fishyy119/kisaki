<script setup lang="ts">
import { computed } from 'vue'
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
  <div class="shrink-0 border-b border-border bg-background/50 px-4 py-2">
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
          placeholder="搜索完成记录..."
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
        {{ props.filteredCount }} 项
      </span>

      <div
        v-if="props.refreshing"
        class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Spinner class="size-3.5" />
        <span>刷新中</span>
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
          <SelectItem value="all">全部分类</SelectItem>
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
          <SelectItem value="all">全部状态</SelectItem>
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
              aria-label="刷新任务列表"
              @click="emit('refresh')"
            >
              <Icon
                icon="icon-[mdi--refresh]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">刷新</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-sm"
              :disabled="props.completedCount === 0 || props.clearing"
              aria-label="清理完成记录"
              @click="emit('clearCompleted')"
            >
              <Icon
                icon="icon-[mdi--trash-can-outline]"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">清理完成记录</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </div>
  </div>
</template>
