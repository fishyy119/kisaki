<!--
Background Task Details Dialog renders task metadata and run history.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { BackgroundTask, BackgroundTaskRunRecord } from '@shared/background-task'
import type { CommandListItem } from '@shared/command'
import {
  formatCronTimezone,
  formatFailurePolicy,
  formatFullTimestamp,
  formatJson,
  formatRunDuration,
  formatTaskTriggers,
  formatTaskTimestamp,
  getRunStatusLabel,
  getRunStatusVariant,
  getTriggerLabel
} from '../utils'

interface Props {
  task: BackgroundTask
  command?: CommandListItem
  running?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  command: undefined,
  running: false
})

const open = defineModel<boolean>('open', { required: true })

const commandTitle = computed(() => props.command?.title ?? props.task.commandId)
const sourceLabel = computed(() =>
  props.task.createdBy === 'extension' ? (props.task.ownerExtensionId ?? '扩展') : '用户'
)
const latestRun = computed(() => props.task.history[0] ?? null)
const argsJson = computed(() => formatJson(props.task.args || {}))
const runResultDialogOpen = ref(false)
const selectedRunRecord = ref<BackgroundTaskRunRecord | null>(null)
const selectedRunResultTitle = computed(() =>
  selectedRunRecord.value
    ? `#${selectedRunRecord.value.attempt} ${formatTaskTimestamp(selectedRunRecord.value.startedAt)}`
    : '运行结果'
)
const selectedRunResultLabel = computed(() =>
  selectedRunRecord.value?.error ? '错误' : '输出'
)
const selectedRunResultText = computed(() =>
  selectedRunRecord.value ? formatRunResult(selectedRunRecord.value) : ''
)

function hasRunResult(record: BackgroundTaskRunRecord): boolean {
  return Boolean(record.error) || record.output !== undefined
}

function formatRunResultPreview(record: BackgroundTaskRunRecord): string {
  if (!hasRunResult(record)) {
    return '无输出'
  }

  return formatRunResult(record)
}

function formatRunResult(record: BackgroundTaskRunRecord): string {
  if (record.error) {
    return record.error
  }

  if (record.output !== undefined) {
    return formatJson(record.output)
  }

  return '无输出'
}

function openRunResult(record: BackgroundTaskRunRecord) {
  selectedRunRecord.value = record
  runResultDialogOpen.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle class="flex min-w-0 items-center gap-2 pr-8">
          <Icon
            icon="icon-[mdi--timer-outline]"
            class="size-5 shrink-0"
          />
          <span class="truncate">{{ props.task.name }}</span>
          <Badge
            v-if="props.running"
            variant="default"
            class="h-5"
          >
            运行中
          </Badge>
          <Badge
            v-if="!props.running && latestRun"
            :variant="getRunStatusVariant(latestRun.status)"
            class="h-5"
          >
            {{ getRunStatusLabel(latestRun.status) }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <DialogBody class="max-h-[72vh] space-y-4 overflow-auto scrollbar-thin">
        <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">命令</div>
            <div class="truncate">{{ commandTitle }}</div>
            <div class="truncate text-xs text-muted-foreground">{{ props.task.commandId }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">来源</div>
            <div class="truncate">{{ sourceLabel }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">触发</div>
            <div class="truncate">{{ formatTaskTriggers(props.task.triggers) }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ formatFailurePolicy(props.task.failurePolicy) }}
            </div>
            <div
              v-if="props.task.triggers.cron"
              class="truncate text-xs text-muted-foreground"
            >
              {{ formatCronTimezone(props.task.triggers) }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">运行时间</div>
            <div class="truncate">最近 {{ formatTaskTimestamp(props.task.lastRunAt) }}</div>
            <div class="truncate text-xs text-muted-foreground">
              下次
              {{ props.task.enabled ? formatTaskTimestamp(props.task.nextRunAt, '无') : '已禁用' }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">创建</div>
            <div class="truncate">{{ formatFullTimestamp(props.task.createdAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">更新</div>
            <div class="truncate">{{ formatFullTimestamp(props.task.updatedAt) }}</div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">参数</div>
          <pre
            class="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground scrollbar-thin"
            >{{ argsJson }}</pre
          >
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-muted-foreground">运行历史</div>
            <span class="text-xs text-muted-foreground">{{ props.task.history.length }} 条</span>
          </div>

          <div
            v-if="props.task.history.length === 0"
            class="flex h-28 flex-col items-center justify-center rounded-md border border-dashed border-border text-muted-foreground"
          >
            <Icon
              icon="icon-[mdi--history]"
              class="mb-2 size-8 opacity-40"
            />
            <div class="text-sm">暂无运行历史</div>
          </div>

          <div
            v-else
            class="overflow-hidden rounded-md border border-border"
          >
            <div
              class="grid h-8 grid-cols-[116px_96px_132px_80px_minmax(160px,1fr)] items-center gap-3 border-b border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground"
            >
              <div>状态</div>
              <div>触发</div>
              <div>开始时间</div>
              <div>耗时</div>
              <div>结果</div>
            </div>
            <div class="max-h-80 divide-y divide-border/60 overflow-auto scrollbar-thin">
              <div
                v-for="record in props.task.history"
                :key="record.id"
                class="grid min-h-10 grid-cols-[116px_96px_132px_80px_minmax(160px,1fr)] items-center gap-3 px-3 py-2 text-xs"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <Badge
                    :variant="getRunStatusVariant(record.status)"
                    class="h-5"
                  >
                    {{ getRunStatusLabel(record.status) }}
                  </Badge>
                  <span class="text-muted-foreground">#{{ record.attempt }}</span>
                </div>
                <div class="text-muted-foreground">{{ getTriggerLabel(record.trigger) }}</div>
                <div class="text-muted-foreground">{{ formatTaskTimestamp(record.startedAt) }}</div>
                <div class="text-muted-foreground">{{ formatRunDuration(record) }}</div>
                <div class="flex min-w-0 items-center gap-1.5">
                  <div class="min-w-0 flex-1 truncate text-muted-foreground">
                    {{ formatRunResultPreview(record) }}
                  </div>
                  <Tooltip v-if="hasRunResult(record)">
                    <TooltipTrigger as-child>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        class="shrink-0"
                        @click="openRunResult(record)"
                      >
                        <Icon
                          icon="icon-[mdi--text-box-search-outline]"
                          class="size-3.5"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>查看完整结果</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </section>
      </DialogBody>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="runResultDialogOpen">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex min-w-0 items-center gap-2 pr-8">
          <Icon
            icon="icon-[mdi--text-box-search-outline]"
            class="size-5 shrink-0"
          />
          <span class="truncate">运行结果 {{ selectedRunResultTitle }}</span>
          <Badge
            v-if="selectedRunRecord"
            :variant="getRunStatusVariant(selectedRunRecord.status)"
            class="h-5"
          >
            {{ getRunStatusLabel(selectedRunRecord.status) }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <DialogBody
        v-if="selectedRunRecord"
        class="max-h-[72vh] space-y-4 overflow-auto scrollbar-thin"
      >
        <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">触发</div>
            <div class="truncate">{{ getTriggerLabel(selectedRunRecord.trigger) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">尝试</div>
            <div class="truncate">#{{ selectedRunRecord.attempt }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">开始</div>
            <div class="truncate">{{ formatFullTimestamp(selectedRunRecord.startedAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">结束</div>
            <div class="truncate">{{ formatFullTimestamp(selectedRunRecord.finishedAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">耗时</div>
            <div class="truncate">{{ formatRunDuration(selectedRunRecord) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">命令</div>
            <div class="truncate">{{ selectedRunRecord.commandId }}</div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">
            {{ selectedRunResultLabel }}
          </div>
          <pre
            class="max-h-[52vh] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground scrollbar-thin"
            >{{ selectedRunResultText }}</pre
          >
        </section>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
