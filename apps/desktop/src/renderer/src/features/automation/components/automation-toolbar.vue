<!--
Automation Toolbar owns local filtering and sorting controls.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils'
import type {
  AutomationSortDirection,
  AutomationSortField,
  AutomationSourceFilter,
  AutomationStatusFilter
} from '../types'

interface Props {
  filteredCount: number
}

const props = defineProps<Props>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const statusFilter = defineModel<AutomationStatusFilter>('statusFilter', { required: true })
const sourceFilter = defineModel<AutomationSourceFilter>('sourceFilter', { required: true })
const sortField = defineModel<AutomationSortField>('sortField', { required: true })
const sortDirection = defineModel<AutomationSortDirection>('sortDirection', { required: true })

const statusOptions: {
  value: AutomationStatusFilter
  label: string
  icon: string
}[] = [
  { value: 'all', label: '全部', icon: 'icon-[mdi--filter-outline]' },
  { value: 'enabled', label: '已启用', icon: 'icon-[mdi--check-circle-outline]' },
  { value: 'disabled', label: '已禁用', icon: 'icon-[mdi--pause-circle-outline]' },
  { value: 'running', label: '运行中', icon: 'icon-[mdi--progress-clock]' },
  { value: 'failed', label: '失败', icon: 'icon-[mdi--alert-circle-outline]' }
]

const sortOptions: { value: AutomationSortField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'name', label: '名称' },
  { value: 'lastRunAt', label: '最近运行' },
  { value: 'nextRunAt', label: '下次运行' }
]

const sourceOptions: { value: AutomationSourceFilter; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'app', label: '应用' },
  { value: 'extension', label: '扩展' }
]

const hasSearch = computed(() => searchQuery.value.trim().length > 0)

function handleClearSearch() {
  searchQuery.value = ''
}

function handleToggleSortDirection() {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
}
</script>

<template>
  <div class="shrink-0 border-b border-border bg-background/50 px-4 py-3">
    <div class="flex items-center gap-3">
      <InputGroup class="max-w-xl flex-1">
        <InputGroupAddon>
          <Icon
            icon="icon-[mdi--magnify]"
            class="size-4"
          />
        </InputGroupAddon>
        <InputGroupInput
          v-model="searchQuery"
          class="text-xs"
          placeholder="搜索自动化..."
        />
        <InputGroupAddon
          v-if="hasSearch"
          align="inline-end"
          class="cursor-pointer"
          @click="handleClearSearch"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-4 text-muted-foreground hover:text-foreground"
          />
        </InputGroupAddon>
      </InputGroup>

      <span class="shrink-0 text-xs text-muted-foreground">{{ props.filteredCount }} 项</span>

      <div class="flex-1" />

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

      <ButtonGroup>
        <Select v-model="sortField">
          <SelectTrigger
            size="sm"
            class="w-28 border-r-0 focus:border-border"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in sortOptions"
              :key="option.value"
              :value="option.value"
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
                  sortDirection === 'asc'
                    ? 'icon-[mdi--sort-ascending]'
                    : 'icon-[mdi--sort-descending]'
                "
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{ sortDirection === 'asc' ? '升序' : '降序' }}
          </TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </div>
  </div>
</template>
