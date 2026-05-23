<!--
Background Task Row renders one task in the dense list.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils'
import type { BackgroundTask } from '@shared/background-task'
import type { CommandListItem } from '@shared/command'
import {
  BACKGROUND_TASK_LIST_GRID_TEMPLATE,
  formatFailurePolicy,
  formatTaskTriggers,
  formatTaskTimestamp,
  getRunStatusLabel,
  getRunStatusVariant
} from '../utils'

interface Props {
  task: BackgroundTask
  command?: CommandListItem
  running?: boolean
  busy?: boolean
}

interface Emits {
  (e: 'run'): void
  (e: 'cancel'): void
  (e: 'setEnabled', enabled: boolean): void
  (e: 'edit'): void
  (e: 'details'): void
  (e: 'delete'): void
}

const props = withDefaults(defineProps<Props>(), {
  command: undefined,
  running: false,
  busy: false
})
const emit = defineEmits<Emits>()

const latestRun = computed(() => props.task.history[0] ?? null)
const commandTitle = computed(() => props.command?.title ?? props.task.commandId)
const commandDescription = computed(() => props.command?.description ?? props.task.commandId)
const sourceLabel = computed(() =>
  props.task.createdBy === 'extension' ? (props.task.ownerExtensionId ?? '扩展') : '用户'
)
const nextRunLabel = computed(() =>
  props.task.enabled ? formatTaskTimestamp(props.task.nextRunAt, '无') : '已禁用'
)
const enabledModel = computed({
  get: () => props.task.enabled,
  set: (enabled: boolean) => emit('setEnabled', enabled)
})
</script>

<template>
  <div
    :class="
      cn(
        'grid min-h-16 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30',
        !props.task.enabled && 'opacity-70'
      )
    "
    :style="{ gridTemplateColumns: BACKGROUND_TASK_LIST_GRID_TEMPLATE }"
  >
    <div class="flex min-w-0 items-center gap-3">
      <Switch
        v-model="enabledModel"
        :disabled="props.busy"
      />
      <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon
          icon="icon-[mdi--timer-outline]"
          class="size-4 text-muted-foreground"
        />
      </div>
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <div class="truncate text-sm font-medium">{{ props.task.name }}</div>
          <Badge
            v-if="props.running"
            variant="default"
            class="h-5"
          >
            <Icon
              icon="icon-[mdi--progress-clock]"
              class="size-3"
            />
            运行中
          </Badge>
        </div>
        <div class="truncate text-xs text-muted-foreground">{{ props.task.commandId }}</div>
      </div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">{{ commandTitle }}</div>
      <div class="truncate text-xs text-muted-foreground">{{ commandDescription }}</div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">{{ formatTaskTriggers(props.task.triggers) }}</div>
      <div class="truncate text-xs text-muted-foreground">
        {{ formatFailurePolicy(props.task.failurePolicy) }}
      </div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">{{ formatTaskTimestamp(props.task.lastRunAt) }}</div>
      <div class="truncate text-xs text-muted-foreground">下次 {{ nextRunLabel }}</div>
    </div>

    <div class="flex min-w-0 flex-col items-start gap-1">
      <Badge
        v-if="latestRun"
        :variant="getRunStatusVariant(latestRun.status)"
        class="h-5"
      >
        {{ getRunStatusLabel(latestRun.status) }}
      </Badge>
      <Badge
        v-else
        variant="secondary"
        class="h-5"
      >
        未运行
      </Badge>
      <span class="truncate text-xs text-muted-foreground">{{ sourceLabel }}</span>
    </div>

    <div class="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            :class="cn(props.running && 'hover:text-destructive')"
            :disabled="props.busy"
            @click="props.running ? emit('cancel') : emit('run')"
          >
            <Icon
              :icon="props.running ? 'icon-[mdi--stop-circle-outline]' : 'icon-[mdi--play-outline]'"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ props.running ? '取消' : '运行' }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            @click="emit('details')"
          >
            <Icon
              icon="icon-[mdi--information-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>详情</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            :disabled="props.busy || props.running"
            @click="emit('edit')"
          >
            <Icon
              icon="icon-[mdi--pencil-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>编辑</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            class="hover:text-destructive"
            :disabled="props.busy || props.running"
            @click="emit('delete')"
          >
            <Icon
              icon="icon-[mdi--delete-outline]"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>删除</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
