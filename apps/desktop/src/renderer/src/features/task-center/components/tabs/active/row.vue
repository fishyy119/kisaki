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
  formatTaskRunStatus,
  getTaskRunCategoryIcon,
  getTaskRunStatusVariant
} from '../../../utils/display'
import TaskRunProgress from './progress.vue'

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
  <TableRow class="group h-16 border-border/50 hover:bg-accent/30">
    <TableCell class="py-2">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon
            :icon="getTaskRunCategoryIcon(props.run.category)"
            class="size-4 text-muted-foreground"
          />
        </div>
        <div class="min-w-0">
          <div class="flex min-w-0 items-center gap-1.5">
            <div class="truncate text-sm font-medium">{{ props.run.title }}</div>
            <Tooltip v-if="warnings.length">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-xs leading-none text-warning hover:bg-warning/10 focus-visible:ring-1 focus-visible:ring-warning focus-visible:outline-none"
                  :aria-label="m.task.row.warningCount({ count: warnings.length })"
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
                    {{
                      m.task.row.moreWarnings({ count: warnings.length - warningPreview.length })
                    }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="truncate text-xs text-muted-foreground">{{ categoryText }}</div>
        </div>
      </div>
    </TableCell>

    <TableCell class="py-2">
      <TaskRunProgress :run="props.run" />
    </TableCell>

    <TableCell class="py-2">
      <Badge
        :variant="getTaskRunStatusVariant(props.run.status)"
        class="h-5"
      >
        {{ formatTaskRunStatus(props.run.status) }}
      </Badge>
    </TableCell>

    <TableCell class="py-2">
      <div class="flex items-center justify-end gap-1">
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
