<!-- Active task details retain phase, timing, and throughput outside the table. -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TaskRun, TaskRunWarning } from '@shared/task-run'
import { useI18n } from '@renderer/composables/use-i18n'
import TaskRunProgress from './progress.vue'
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
  formatTaskRunCategory,
  formatTaskRunDuration,
  formatTaskRunInitiator,
  formatTaskRunOperation,
  formatTaskRunOwner,
  formatTaskRunStatus,
  formatTaskRunSubject,
  formatTimestamp,
  getTaskRunCategoryIcon,
  getTaskRunStatusVariant
} from '../../../utils/display'

interface Props {
  run: TaskRun
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const warnings = computed<readonly TaskRunWarning[]>(() => props.run.progress?.warnings ?? [])
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
  { label: m.value.task.details.duration, value: formatTaskRunDuration(props.run) }
])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="xl">
      <DialogHeader>
        <DialogTitle :icon="getTaskRunCategoryIcon(props.run.category)">
          {{ props.run.title }}
          <template #trailing>
            <Badge
              :variant="getTaskRunStatusVariant(props.run.status)"
              class="h-5"
            >
              {{ formatTaskRunStatus(props.run.status) }}
            </Badge>
          </template>
        </DialogTitle>
      </DialogHeader>

      <DialogBody class="space-y-4 overflow-x-hidden">
        <section class="space-y-2">
          <div class="text-xs font-medium text-muted-foreground">{{ m.task.table.progress }}</div>
          <TaskRunProgress :run="props.run" />
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
                <div class="wrap-break-word">{{ warning.message }}</div>
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
              <div class="wrap-break-word">{{ props.run.description }}</div>
            </div>

            <template
              v-for="item in metadata"
              :key="item.label"
            >
              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">{{ item.label }}</div>
                <div class="wrap-break-word">{{ item.value }}</div>
              </div>
            </template>
          </section>
        </section>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
