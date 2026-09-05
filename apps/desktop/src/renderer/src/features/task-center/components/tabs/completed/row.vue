<!-- Completed task records, with one field per table column. -->
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
const warnings = computed<readonly TaskRunWarning[]>(() => props.run.result?.warnings ?? [])
const warningPreview = computed(() => warnings.value.slice(0, 3))
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
      :class="props.run.status === 'failed' && 'text-destructive'"
      :title="resultText"
    >
      {{ resultText }}
    </TableCell>
    <TableCell
      class="truncate tabular-nums"
      :title="formatTaskRunDuration(props.run)"
    >
      {{ formatTaskRunDuration(props.run) }}
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
