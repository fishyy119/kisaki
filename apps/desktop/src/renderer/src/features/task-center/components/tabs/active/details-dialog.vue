<script setup lang="ts">
import { computed } from 'vue'
import type { TaskRun, TaskRunWarning } from '@shared/task-run'
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

const warnings = computed<readonly TaskRunWarning[]>(() => props.run.progress?.warnings ?? [])
const metadata = computed(() => [
  { label: '任务 ID', value: props.run.id },
  { label: '分类', value: formatTaskRunCategory(props.run.category) },
  { label: '操作', value: formatTaskRunOperation(props.run.operation) },
  { label: '操作 ID', value: props.run.operation },
  { label: '来源', value: formatTaskRunOwner(props.run) },
  { label: '发起', value: formatTaskRunInitiator(props.run) },
  { label: '对象', value: formatTaskRunSubject(props.run) },
  { label: '创建', value: formatTimestamp(props.run.createdAt) },
  { label: '开始', value: formatTimestamp(props.run.startedAt) },
  { label: '耗时', value: formatTaskRunDuration(props.run) }
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

      <DialogBody class="max-h-[72vh] space-y-4 overflow-auto overflow-x-hidden">
        <section
          v-if="warnings.length"
          class="space-y-2"
        >
          <div class="text-xs font-medium text-muted-foreground">警告</div>
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
          <div class="text-xs font-medium text-muted-foreground">信息</div>
          <section class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div
              v-if="props.run.description"
              class="col-span-2 min-w-0"
            >
              <div class="text-xs text-muted-foreground">描述</div>
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
