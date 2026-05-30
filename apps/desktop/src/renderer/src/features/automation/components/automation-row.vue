<!--
Automation Row renders one automation in the dense list.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/utils'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'
import {
  formatFailurePolicy,
  formatAutomationTriggers,
  formatAutomationTimestamp,
  getRunStatusLabel,
  getRunStatusVariant
} from '../utils'

interface Props {
  automation: Automation
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

const latestRun = computed(() => props.automation.history[0] ?? null)
const commandTitle = computed(() => props.command?.title ?? props.automation.commandId)
const commandDescription = computed(() => props.command?.description ?? props.automation.commandId)
const sourceLabel = computed(() =>
  props.automation.owner.type === 'extension'
    ? (props.automation.owner.extension.nameSnapshot ?? props.automation.owner.extension.id)
    : '应用'
)
const nextRunLabel = computed(() =>
  props.automation.enabled ? formatAutomationTimestamp(props.automation.nextRunAt, '无') : '已禁用'
)
const enabledModel = computed({
  get: () => props.automation.enabled,
  set: (enabled: boolean) => emit('setEnabled', enabled)
})
</script>

<template>
  <div
    :class="
      cn(
        'grid min-h-16 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30',
        !props.automation.enabled && 'opacity-70'
      )
    "
    style="
      grid-template-columns:
        minmax(240px, 2fr) minmax(180px, 1.2fr) minmax(150px, 1fr) minmax(150px, 1fr)
        minmax(120px, 0.7fr) 132px;
    "
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
          <div class="truncate text-sm font-medium">{{ props.automation.name }}</div>
        </div>
        <div class="truncate text-xs text-muted-foreground">{{ props.automation.commandId }}</div>
      </div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">{{ commandTitle }}</div>
      <div class="truncate text-xs text-muted-foreground">{{ commandDescription }}</div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">{{ formatAutomationTriggers(props.automation.triggers) }}</div>
      <div class="truncate text-xs text-muted-foreground">
        {{ formatFailurePolicy(props.automation.failurePolicy) }}
      </div>
    </div>

    <div class="min-w-0">
      <div class="truncate text-sm">
        {{ formatAutomationTimestamp(props.automation.lastRunAt) }}
      </div>
      <div class="truncate text-xs text-muted-foreground">下次 {{ nextRunLabel }}</div>
    </div>

    <div class="flex min-w-0 flex-col items-start gap-1">
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
      <Badge
        v-else-if="latestRun"
        :variant="getRunStatusVariant(latestRun.invocationStatus)"
        class="h-5"
      >
        {{ getRunStatusLabel(latestRun.invocationStatus) }}
      </Badge>
      <Badge
        v-else
        variant="secondary"
        class="h-5"
      >
        未调用
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
        <TooltipContent>{{ props.running ? '停止重试' : '运行' }}</TooltipContent>
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
