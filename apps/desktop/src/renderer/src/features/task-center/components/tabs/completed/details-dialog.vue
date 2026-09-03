<script setup lang="ts">
import { computed } from 'vue'
import type { TaskRun, TaskRunWarning } from '@shared/task-run'
import { useI18n } from '@renderer/composables/use-i18n'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  formatCounterKey,
  formatJsonPreview,
  formatTaskRunCategory,
  formatTaskRunCounterValue,
  formatTaskRunDuration,
  formatTaskRunInitiator,
  formatTaskRunOperation,
  formatTaskRunOwner,
  formatTaskRunStatus,
  formatTaskRunSubject,
  formatTimestamp,
  getTaskRunCategoryIcon,
  getTaskRunCounterEntries,
  getTaskRunStatusVariant
} from '../../../utils/display'

const TASK_RUN_OUTPUT_PREVIEW_MAX_CHARS = 6000

interface Props {
  run: TaskRun
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const result = computed(() => props.run.result)
const counters = computed(() => getTaskRunCounterEntries(result.value?.counters))
const warnings = computed<readonly TaskRunWarning[]>(() => result.value?.warnings ?? [])
const outputPreview = computed(() => {
  if (result.value?.output === undefined) return null
  return formatJsonPreview(result.value.output, TASK_RUN_OUTPUT_PREVIEW_MAX_CHARS)
})
const resultIcon = computed(() => {
  switch (props.run.status) {
    case 'completed':
      return 'icon-[mdi--check-circle-outline]'
    case 'failed':
      return 'icon-[mdi--alert-circle-outline]'
    case 'cancelled':
      return 'icon-[mdi--cancel]'
    default:
      return 'icon-[mdi--information-outline]'
  }
})
const resultIconClass = computed(() => {
  switch (props.run.status) {
    case 'completed':
      return 'text-success'
    case 'failed':
      return 'text-destructive'
    case 'cancelled':
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
  }
})
const metadata = computed(() => [
  { label: m.value.task.details.runId, value: props.run.id },
  { label: m.value.task.details.category, value: formatTaskRunCategory(props.run.category) },
  { label: m.value.task.details.operation, value: formatTaskRunOperation(props.run.operation) },
  { label: m.value.task.details.operationId, value: props.run.operation },
  { label: m.value.task.details.owner, value: formatTaskRunOwner(props.run) },
  { label: m.value.task.details.initiator, value: formatTaskRunInitiator(props.run) },
  { label: m.value.task.details.subject, value: formatTaskRunSubject(props.run) },
  { label: m.value.task.details.createdAt, value: formatTimestamp(props.run.createdAt) },
  { label: m.value.task.details.startedAt, value: formatTimestamp(props.run.startedAt) },
  { label: m.value.task.details.finishedAt, value: formatTimestamp(props.run.finishedAt) },
  { label: m.value.task.details.duration, value: formatTaskRunDuration(props.run) }
])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle class="flex min-w-0 items-center gap-2 pr-8">
          <Icon
            :icon="getTaskRunCategoryIcon(props.run.category)"
            class="size-5 shrink-0"
          />
          <span class="truncate">{{ props.run.title }}</span>
          <Badge
            :variant="getTaskRunStatusVariant(props.run.status)"
            class="h-5"
          >
            {{ formatTaskRunStatus(props.run.status) }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <DialogBody class="max-h-[72vh] space-y-4 overflow-x-hidden">
        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">{{ m.task.details.result }}</div>
          <div class="overflow-hidden rounded-md border border-border bg-muted/20">
            <div class="flex items-start gap-2.5 px-3 py-2.5">
              <Icon
                :icon="resultIcon"
                class="mt-0.5 size-4 shrink-0"
                :class="resultIconClass"
              />
              <div class="min-w-0 flex-1 text-sm">
                <div
                  v-if="result?.title"
                  class="mb-1 truncate text-sm font-medium text-foreground"
                >
                  {{ result.title }}
                </div>
                <p
                  v-if="result?.summary"
                  class="text-xs leading-relaxed text-muted-foreground"
                >
                  {{ result.summary }}
                </p>
                <p
                  v-if="result?.error"
                  class="mt-1 text-xs leading-relaxed text-destructive/80"
                >
                  {{ result.error }}
                </p>
                <p
                  v-if="!result?.summary && !result?.error"
                  class="text-muted-foreground"
                >
                  {{ m.task.details.noResultSummary }}
                </p>
              </div>
            </div>

            <div
              v-if="counters.length"
              class="border-t border-border px-3 py-2"
            >
              <dl class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <div
                  v-for="[key, value] in counters"
                  :key="key"
                  class="min-w-0"
                >
                  <dt class="text-xs text-muted-foreground">{{ formatCounterKey(key) }}</dt>
                  <dd class="truncate">{{ formatTaskRunCounterValue(props.run, key, value) }}</dd>
                </div>
              </dl>
            </div>

            <div
              v-if="outputPreview"
              class="border-t border-border"
            >
              <div
                class="border-b border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {{ m.task.details.output }}
              </div>
              <pre
                class="max-h-56 overflow-auto bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground"
                >{{ outputPreview }}</pre>
            </div>
          </div>
        </section>

        <section
          v-if="warnings.length"
          class="space-y-2"
        >
          <div class="text-xs font-medium text-muted-foreground">{{ m.task.details.warnings }}</div>
          <div class="overflow-hidden rounded-md border border-border bg-muted/20">
            <div
              v-for="(warning, index) in warnings"
              :key="`${warning.code ?? 'warning'}-${index}`"
              class="flex gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <Icon
                icon="icon-[mdi--alert-outline]"
                class="mt-0.5 size-3.5 shrink-0 text-warning"
              />
              <div class="min-w-0">
                <div
                  v-if="warning.code"
                  class="text-xs text-muted-foreground"
                >
                  {{ warning.code }}
                </div>
                <div class="break-words">{{ warning.message }}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">{{ m.task.details.info }}</div>
          <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div
              v-if="props.run.description"
              class="col-span-2 min-w-0"
            >
              <div class="text-xs text-muted-foreground">{{ m.task.details.description }}</div>
              <div class="break-words">{{ props.run.description }}</div>
            </div>

            <template
              v-for="item in metadata"
              :key="item.label"
            >
              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">{{ item.label }}</div>
                <div class="break-words">{{ item.value }}</div>
              </div>
            </template>
          </section>
        </section>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
