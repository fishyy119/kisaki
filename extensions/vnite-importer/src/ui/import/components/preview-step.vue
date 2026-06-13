<!-- Step 3: write plan preview computed by the host. -->
<script setup lang="ts">
import { computed } from 'vue'
import {
  Button,
  Field,
  FieldContent,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@kisaki3/extension-ui-vue'
import type { VnitePreviewDto } from '../../../shared/import-wizard'
import StatCards, { type StatCard } from './stat-cards.vue'

interface Props {
  preview: VnitePreviewDto
  diagnosticsTotal: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openDiagnostics: []
}>()

const stats = computed<readonly StatCard[]>(() => [
  { label: '新增', value: props.preview.summary.created },
  { label: '更新', value: props.preview.summary.updated },
  { label: '跳过', value: props.preview.summary.skipped, tone: 'warning' },
  { label: '错误', value: props.preview.summary.errors, tone: 'destructive' },
  { label: '警告', value: props.preview.summary.warnings, tone: 'warning' }
])
</script>

<template>
  <div class="space-y-4">
    <StatCards :stats="stats" />

    <section class="space-y-1.5">
      <div class="flex items-baseline justify-between">
        <h3 class="text-sm font-medium">写入计划</h3>
        <span class="text-xs text-muted-foreground">
          {{
            props.preview.writePlanTotal > props.preview.writePlan.length
              ? `前 ${props.preview.writePlan.length} / ${props.preview.writePlanTotal}`
              : `共 ${props.preview.writePlanTotal} 个游戏`
          }}
        </span>
      </div>
      <ul class="columns-2 list-disc pl-4 text-xs leading-relaxed text-foreground">
        <li
          v-for="title in props.preview.writePlan"
          :key="title"
        >
          {{ title }}
        </li>
      </ul>
    </section>

    <section
      v-if="props.preview.updates.length > 0"
      class="space-y-1.5"
    >
      <div class="flex items-baseline justify-between">
        <h3 class="text-sm font-medium">已有游戏更新计划</h3>
        <span class="text-xs text-muted-foreground">
          {{
            props.preview.updatesTotal > props.preview.updates.length
              ? `前 ${props.preview.updates.length} / ${props.preview.updatesTotal}`
              : `共 ${props.preview.updatesTotal} 个游戏`
          }}
        </span>
      </div>
      <article
        v-for="group in props.preview.updates"
        :key="group.id"
        class="rounded-md border border-border"
      >
        <h4 class="border-b border-border px-3 py-1.5 text-xs font-medium">{{ group.title }}</h4>
        <Table>
          <TableBody>
            <TableRow
              v-for="(row, index) in group.rows"
              :key="index"
              class="hover:bg-transparent"
            >
              <TableCell class="w-20 pl-3 whitespace-nowrap text-muted-foreground">
                {{ row.label }}
              </TableCell>
              <TableCell class="text-muted-foreground">{{ row.before }}</TableCell>
              <TableCell class="w-8 text-center text-muted-foreground">→</TableCell>
              <TableCell>{{ row.after }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </article>
    </section>

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
  </div>
</template>
