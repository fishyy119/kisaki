<!-- Active task records, with one field per table column. -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TaskRun, TaskRunWarning } from '@shared/task-run'
import { useI18n } from '@renderer/composables/use-i18n'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { TableCell, TableRow } from '@renderer/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  formatTaskRunCategory,
  formatTaskRunPhase,
  formatProgressPercent,
  getProgressPercentValue,
  formatTaskRunStatus,
  getTaskRunCategoryIcon,
  getTaskRunStatusVariant
} from '../../../utils/display'
import { Progress } from '@renderer/components/ui/progress'
import { Spinner } from '@renderer/components/ui/spinner'

interface Props {
  run: TaskRun
  busy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  busy: false
})

const emit = defineEmits<{
  details: [run: TaskRun]
  pause: [run: TaskRun]
  resume: [run: TaskRun]
  cancel: [run: TaskRun]
}>()

const { m } = useI18n()

const percentValue = computed(() =>
  props.run.progress?.work?.indeterminate ? null : getProgressPercentValue(props.run)
)
const percentText = computed(() =>
  percentValue.value === null ? m.value.task.progress.inProgress : formatProgressPercent(props.run)
)
const phaseText = computed(() => formatTaskRunPhase(props.run))
const categoryText = computed(() => formatTaskRunCategory(props.run.category))
const warnings = computed<readonly TaskRunWarning[]>(() => props.run.progress?.warnings ?? [])
const warningPreview = computed(() => warnings.value.slice(0, 3))
const canPause = computed(
  () => props.run.controls.pausable && props.run.status === 'running' && !props.busy
)
const canResume = computed(
  () => props.run.controls.pausable && props.run.status === 'paused' && !props.busy
)
const canCancel = computed(
  () => props.run.controls.cancelable && props.run.status !== 'cancelling' && !props.busy
)
</script>

<template>
  <TableRow class="group border-border/50 hover:bg-accent/30">
    <TableCell>
      <div class="flex min-w-0 items-center gap-2">
        <Icon
          :icon="getTaskRunCategoryIcon(props.run.category)"
          class="size-4 shrink-0 text-muted-foreground"
          :title="categoryText"
        />
        <span
          class="truncate font-medium"
          :title="props.run.title"
          >{{ props.run.title }}</span
        >
      </div>
    </TableCell>

    <TableCell
      class="truncate"
      :title="phaseText"
      >{{ phaseText }}</TableCell
    >
    <TableCell>
      <div class="flex min-w-0 items-center gap-2">
        <Progress
          v-if="percentValue !== null"
          :model-value="percentValue"
          :aria-label="m.task.table.progress"
          class="h-1.5 min-w-0 flex-1"
        />
        <Spinner
          v-else
          class="size-3.5 shrink-0"
        />
        <span
          class="truncate tabular-nums"
          :title="percentText ?? undefined"
          >{{ percentText }}</span
        >
      </div>
    </TableCell>

    <TableCell>
      <Badge
        :variant="getTaskRunStatusVariant(props.run.status)"
        class="h-5"
      >
        {{ formatTaskRunStatus(props.run.status) }}
      </Badge>
    </TableCell>

    <TableCell>
      <div class="flex items-center justify-end gap-1">
        <Tooltip v-if="warnings.length">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-xs leading-none text-warning hover:bg-warning/10 focus-visible:ring-1 focus-visible:ring-warning focus-visible:outline-none"
              :aria-label="m.task.row.warningCount({ count: warnings.length })"
              @click="emit('details', props.run)"
            >
              <Icon
                icon="icon-[mdi--alert-outline]"
                class="size-3.5"
              />
              <span>{{ warnings.length }}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            class="max-w-72"
          >
            <div class="space-y-1">
              <div
                v-for="(warning, index) in warningPreview"
                :key="`${warning.code ?? 'warning'}-${index}`"
                class="text-xs"
              >
                {{ warning.message }}
              </div>
              <div
                v-if="warnings.length > warningPreview.length"
                class="text-xs text-muted-foreground"
              >
                {{ m.task.row.moreWarnings({ count: warnings.length - warningPreview.length }) }}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
        <Button
          v-if="props.run.controls.pausable && props.run.status !== 'paused'"
          variant="ghost"
          size="icon-sm"
          :tooltip="m.task.row.pause"
          :disabled="!canPause"
          :aria-label="m.task.row.pauseTask"
          @click="emit('pause', props.run)"
        >
          <Icon
            icon="icon-[mdi--pause]"
            class="size-4"
          />
        </Button>

        <Button
          v-if="props.run.controls.pausable && props.run.status === 'paused'"
          variant="ghost"
          size="icon-sm"
          :tooltip="m.task.row.resume"
          :disabled="!canResume"
          :aria-label="m.task.row.resumeTask"
          @click="emit('resume', props.run)"
        >
          <Icon
            icon="icon-[mdi--play]"
            class="size-4"
          />
        </Button>

        <Button
          v-if="props.run.controls.cancelable || props.run.status === 'cancelling'"
          variant="ghost"
          size="icon-sm"
          :tooltip="m.task.row.cancel"
          :disabled="!canCancel"
          :aria-label="m.task.row.cancelTask"
          class="hover:text-destructive"
          @click="emit('cancel', props.run)"
        >
          <Icon
            icon="icon-[mdi--stop]"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.task.row.details"
          :aria-label="m.task.row.viewDetails"
          @click="emit('details', props.run)"
        >
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-4"
          />
        </Button>
      </div>
    </TableCell>
  </TableRow>
</template>
