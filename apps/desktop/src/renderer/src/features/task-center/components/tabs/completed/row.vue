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
  formatTaskRunCounterSummary,
  formatTaskRunDuration,
  formatTaskRunResultSummary,
  formatTaskRunStatus,
  getTaskRunCategoryIcon,
  getTaskRunStatusVariant
} from '../../../utils/display'

interface Props {
  run: TaskRun
}

const props = defineProps<Props>()

const emit = defineEmits<{
  details: [run: TaskRun]
  delete: [run: TaskRun]
}>()

const { m } = useI18n()

const categoryText = computed(() => formatTaskRunCategory(props.run.category))
const resultText = computed(() => formatTaskRunResultSummary(props.run))
const counterText = computed(() =>
  formatTaskRunCounterSummary(props.run, props.run.result?.counters, 3)
)
const warnings = computed<readonly TaskRunWarning[]>(() => props.run.result?.warnings ?? [])
const warningPreview = computed(() => warnings.value.slice(0, 3))
</script>

<template>
  <TableRow class="group h-16 border-border/50 hover:bg-accent/30">
    <TableCell class="py-2 pl-4">
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

    <TableCell class="min-w-0 space-y-1 py-2">
      <div
        class="truncate text-xs"
        :class="props.run.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'"
      >
        {{ resultText }}
      </div>
      <div
        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-muted-foreground"
      >
        <span>
          <span>{{ m.task.row.duration }}</span>
          <span class="ml-1 text-foreground">{{ formatTaskRunDuration(props.run) }}</span>
        </span>
        <span
          v-if="counterText"
          class="min-w-0"
        >
          <span>{{ m.task.row.counters }}</span>
          <span class="ml-1 text-foreground">{{ counterText }}</span>
        </span>
      </div>
    </TableCell>

    <TableCell class="py-2">
      <Badge
        :variant="getTaskRunStatusVariant(props.run.status)"
        class="h-5"
      >
        {{ formatTaskRunStatus(props.run.status) }}
      </Badge>
    </TableCell>

    <TableCell class="py-2 pr-4">
      <div class="flex items-center justify-end gap-1">
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

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.task.row.deleteRecord"
          :aria-label="m.task.row.deleteRecord"
          class="hover:text-destructive"
          @click="emit('delete', props.run)"
        >
          <Icon
            icon="icon-[mdi--trash-can-outline]"
            class="size-4"
          />
        </Button>
      </div>
    </TableCell>
  </TableRow>
</template>
