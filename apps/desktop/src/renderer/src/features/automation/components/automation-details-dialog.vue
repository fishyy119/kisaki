<!--
Automation Details Dialog renders automation metadata and run history.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { Automation, AutomationRunHistoryRecord } from '@shared/automation'
import type { CommandListItem } from '@shared/command'
import {
  formatCronTimezone,
  formatFailurePolicy,
  formatFullTimestamp,
  formatJson,
  formatRunDuration,
  formatAutomationTriggers,
  formatAutomationTimestamp,
  getRunStatusLabel,
  getRunStatusVariant,
  getTriggerLabel
} from '../utils/display'

interface Props {
  automation: Automation
  command?: CommandListItem
  running?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  command: undefined,
  running: false
})

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const commandTitle = computed(() => props.command?.title ?? props.automation.commandId)
const sourceLabel = computed(() =>
  props.automation.owner.type === 'extension'
    ? (props.automation.owner.extension.nameSnapshot ?? props.automation.owner.extension.id)
    : m.value.automation.details.app
)
const latestRun = computed(() => props.automation.history[0] ?? null)
const historyRows = computed(() =>
  props.automation.history.map((record, index) => ({
    record,
    sequence: props.automation.history.length - index
  }))
)
const argsJson = computed(() => formatJson(props.automation.args || {}))
const runResultDialogOpen = ref(false)
const selectedRunRecord = ref<AutomationRunHistoryRecord | null>(null)
const selectedRunSequence = computed(() =>
  selectedRunRecord.value ? getRunSequence(selectedRunRecord.value) : undefined
)
const selectedRunResultTitle = computed(() =>
  selectedRunRecord.value
    ? `#${selectedRunSequence.value ?? '?'} ${formatAutomationTimestamp(selectedRunRecord.value.startedAt)}`
    : m.value.automation.details.runResult
)
const selectedRunResultLabel = computed(() =>
  selectedRunRecord.value?.error
    ? m.value.automation.details.error
    : m.value.automation.details.result
)
const selectedRunResultText = computed(() =>
  selectedRunRecord.value ? formatRunResult(selectedRunRecord.value) : ''
)

function hasRunResult(record: AutomationRunHistoryRecord): boolean {
  return Boolean(record.error)
}

function formatRunResultPreview(record: AutomationRunHistoryRecord): string {
  if (!hasRunResult(record)) {
    return m.value.automation.details.noError
  }

  return formatRunResult(record)
}

function formatRunResult(record: AutomationRunHistoryRecord): string {
  if (record.error) {
    return record.error.message
  }

  return m.value.automation.details.noError
}

function getRunSequence(record: AutomationRunHistoryRecord): number | undefined {
  const index = props.automation.history.findIndex((item) => item.id === record.id)
  return index === -1 ? undefined : props.automation.history.length - index
}

function openRunResult(record: AutomationRunHistoryRecord) {
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
          <span class="truncate">{{ props.automation.name }}</span>
          <Badge
            v-if="props.running"
            variant="default"
            class="h-5"
          >
            {{ m.automation.details.running }}
          </Badge>
          <Badge
            v-if="!props.running && latestRun"
            :variant="getRunStatusVariant(latestRun.invocationStatus)"
            class="h-5"
          >
            {{ getRunStatusLabel(latestRun.invocationStatus) }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <DialogBody class="max-h-[72vh] space-y-4 overflow-auto">
        <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.command }}</div>
            <div class="truncate">{{ commandTitle }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ props.automation.commandId }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.source }}</div>
            <div class="truncate">{{ sourceLabel }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.trigger }}</div>
            <div class="truncate">{{ formatAutomationTriggers(props.automation.triggers) }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ formatFailurePolicy(props.automation.failurePolicy) }}
            </div>
            <div
              v-if="props.automation.triggers.cron"
              class="truncate text-xs text-muted-foreground"
            >
              {{ formatCronTimezone(props.automation.triggers) }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.runTime }}</div>
            <div class="truncate">
              {{
                m.automation.details.lastRun({
                  time: formatAutomationTimestamp(props.automation.lastRunAt)
                })
              }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{
                m.automation.details.nextRun({
                  time: props.automation.enabled
                    ? formatAutomationTimestamp(
                        props.automation.nextRunAt,
                        m.automation.details.nextNone
                      )
                    : m.automation.details.nextDisabled
                })
              }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.createdAt }}</div>
            <div class="truncate">{{ formatFullTimestamp(props.automation.createdAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.updatedAt }}</div>
            <div class="truncate">{{ formatFullTimestamp(props.automation.updatedAt) }}</div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">
            {{ m.automation.details.params }}
          </div>
          <pre
            class="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground"
            >{{ argsJson }}</pre>
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-muted-foreground">
              {{ m.automation.details.history }}
            </div>
            <span class="text-xs text-muted-foreground">
              {{ m.automation.details.historyCount({ count: props.automation.history.length }) }}
            </span>
          </div>

          <StateView
            v-if="props.automation.history.length === 0"
            state="empty"
            icon="icon-[mdi--history]"
            :description="m.automation.details.noHistory"
            class="h-28 rounded-md border border-dashed border-border"
          />

          <div
            v-else
            class="overflow-hidden rounded-md border border-border"
          >
            <div
              class="grid h-8 grid-cols-[116px_96px_132px_80px_minmax(160px,1fr)] items-center gap-3 border-b border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground"
            >
              <div>{{ m.automation.details.historyRun }}</div>
              <div>{{ m.automation.details.historyTrigger }}</div>
              <div>{{ m.automation.details.historyStartedAt }}</div>
              <div>{{ m.automation.details.historyDuration }}</div>
              <div>{{ m.automation.details.historyResult }}</div>
            </div>
            <div class="max-h-80 divide-y divide-border/60 overflow-auto">
              <div
                v-for="row in historyRows"
                :key="row.record.id"
                class="grid min-h-10 grid-cols-[116px_96px_132px_80px_minmax(160px,1fr)] items-center gap-3 px-3 py-2 text-xs"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <span class="w-8 shrink-0 tabular-nums text-muted-foreground"
                    >#{{ row.sequence }}</span
                  >
                  <Badge
                    :variant="getRunStatusVariant(row.record.invocationStatus)"
                    class="h-5"
                  >
                    {{ getRunStatusLabel(row.record.invocationStatus) }}
                  </Badge>
                </div>
                <div class="text-muted-foreground">{{ getTriggerLabel(row.record.trigger) }}</div>
                <div class="text-muted-foreground">
                  {{ formatAutomationTimestamp(row.record.startedAt) }}
                </div>
                <div class="text-muted-foreground">{{ formatRunDuration(row.record) }}</div>
                <div class="flex min-w-0 items-center gap-1.5">
                  <div class="min-w-0 flex-1 truncate text-muted-foreground">
                    {{ formatRunResultPreview(row.record) }}
                  </div>
                  <Button
                    v-if="hasRunResult(row.record)"
                    size="icon-xs"
                    variant="ghost"
                    class="shrink-0"
                    :tooltip="m.automation.details.viewFullResult"
                    @click="openRunResult(row.record)"
                  >
                    <Icon
                      icon="icon-[mdi--text-box-search-outline]"
                      class="size-3.5"
                    />
                  </Button>
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
          <span class="truncate">
            {{ m.automation.details.runResultTitle({ title: selectedRunResultTitle }) }}
          </span>
          <Badge
            v-if="selectedRunRecord"
            :variant="getRunStatusVariant(selectedRunRecord.invocationStatus)"
            class="h-5"
          >
            {{ getRunStatusLabel(selectedRunRecord.invocationStatus) }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <DialogBody
        v-if="selectedRunRecord"
        class="max-h-[72vh] space-y-4 overflow-auto"
      >
        <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.trigger }}</div>
            <div class="truncate">{{ getTriggerLabel(selectedRunRecord.trigger) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.attempt }}</div>
            <div class="truncate">#{{ selectedRunRecord.attempt }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.startedAt }}</div>
            <div class="truncate">{{ formatFullTimestamp(selectedRunRecord.startedAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.finishedAt }}</div>
            <div class="truncate">{{ formatFullTimestamp(selectedRunRecord.finishedAt) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.duration }}</div>
            <div class="truncate">{{ formatRunDuration(selectedRunRecord) }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ m.automation.details.command }}</div>
            <div class="truncate">{{ selectedRunRecord.commandId }}</div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">
            {{ selectedRunResultLabel }}
          </div>
          <pre
            class="max-h-[52vh] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground"
            >{{ selectedRunResultText }}</pre>
        </section>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
