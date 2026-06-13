<!-- Step 5: final report summary recorded by the extension host. -->
<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, Field, FieldContent } from '@kisaki3/extension-ui-vue'
import type { VniteDoneSummaryDto } from '../../../shared/import-wizard'
import StatCards, { type StatCard } from './stat-cards.vue'

interface Props {
  summary: VniteDoneSummaryDto | null
  diagnosticsTotal: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openDiagnostics: []
}>()

const statusAlert = computed(() => {
  switch (props.summary?.status) {
    case 'completed':
      return { variant: 'success' as const, text: `已从 ${props.summary.fileName} 完成导入。` }
    case 'cancelled':
      return { variant: 'warning' as const, text: '导入已取消，已完成的部分不会回滚。' }
    case 'failed':
      return { variant: 'destructive' as const, text: '导入失败，详情见诊断列表。' }
    default:
      return null
  }
})

const stats = computed<readonly StatCard[]>(() => {
  const summary = props.summary
  if (!summary) {
    return []
  }

  return [
    { label: '新增', value: summary.created },
    { label: '更新', value: summary.updated },
    { label: '补全成功', value: summary.completionCompleted },
    { label: '错误', value: summary.errors, tone: 'destructive' },
    { label: '警告', value: summary.warnings, tone: 'warning' }
  ]
})
</script>

<template>
  <div class="space-y-4">
    <template v-if="props.summary">
      <Alert
        v-if="statusAlert"
        :variant="statusAlert.variant"
      >
        {{ statusAlert.text }}
      </Alert>

      <StatCards :stats="stats" />

      <Field
        v-if="props.diagnosticsTotal > 0"
        orientation="horizontal"
        label="诊断"
        :description="`需要处理 ${props.diagnosticsTotal} 项。`"
      >
        <FieldContent class="flex-row items-center">
          <Button
            variant="outline"
            type="button"
            @click="emit('openDiagnostics')"
          >
            查看诊断
          </Button>
        </FieldContent>
      </Field>
    </template>
    <Alert v-else>导入任务已结束。</Alert>
  </div>
</template>
