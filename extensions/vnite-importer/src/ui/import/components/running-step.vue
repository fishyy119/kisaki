<!-- Step 4: live run progress pushed by the extension host. -->
<script setup lang="ts">
import { computed } from 'vue'
import {
  Alert,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@kisaki3/extension-ui-vue'
import type { TaskRunStatus } from '@kisaki3/extension-sdk'
import type { VniteRunDto } from '../../../shared/import-wizard'

const RUN_STATUS_LABELS: Record<TaskRunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  pausing: '暂停中',
  paused: '已暂停',
  cancelling: '取消中',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消'
}

const COUNTER_LABELS: Record<string, string> = {
  gamesTotal: '游戏总数',
  gamesCreated: '新增游戏',
  gamesUpdated: '更新游戏',
  gamesSkipped: '跳过游戏',
  gamesFailed: '失败游戏',
  collectionsCreated: '新增合集',
  collectionsUpdated: '更新合集',
  attachmentsImported: '导入附件',
  attachmentsFailed: '附件失败',
  completionCompleted: '补全成功',
  completionFailed: '补全失败',
  errors: '错误',
  warnings: '警告'
}

interface Props {
  run: VniteRunDto | null
}

const props = defineProps<Props>()

const statusText = computed(() => {
  const run = props.run
  if (!run) {
    return RUN_STATUS_LABELS.running
  }

  return run.phaseLabel ?? RUN_STATUS_LABELS[run.status]
})

const counterRows = computed(() =>
  Object.entries(props.run?.counters ?? {}).map(([key, value]) => ({
    key,
    label: COUNTER_LABELS[key] ?? key,
    value
  }))
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2 text-sm">
      <Spinner class="text-primary" />
      <span>{{ statusText }}</span>
    </div>

    <Alert variant="info">导入运行中，取消请到任务中心处理。</Alert>

    <Table v-if="counterRows.length > 0">
      <TableHeader>
        <TableRow>
          <TableHead>项目</TableHead>
          <TableHead class="text-right">数量</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in counterRows"
          :key="row.key"
        >
          <TableCell>{{ row.label }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ row.value }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
