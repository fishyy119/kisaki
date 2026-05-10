<script setup lang="ts">
import { computed } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import type { ExtensionResolvedSettingsPanelTableNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelTableNode
}>()

const columns = computed(() => {
  if (props.node.columns?.length) {
    return props.node.columns
  }

  const firstRow = props.node.rows[0]
  if (!firstRow) {
    return []
  }

  return Object.keys(firstRow).map((key) => ({ key, label: key }))
})
</script>

<template>
  <div class="w-full space-y-2">
    <div
      v-if="props.node.title"
      class="text-sm font-medium"
    >
      {{ props.node.title }}
    </div>
    <div
      v-if="props.node.rows.length > 0"
      class="overflow-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="column in columns"
              :key="column.key"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(row, rowIndex) in props.node.rows"
            :key="rowIndex"
          >
            <TableCell
              v-for="column in columns"
              :key="column.key"
            >
              {{ row[column.key] }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p
      v-else-if="props.node.emptyLabel"
      class="text-sm text-muted-foreground"
    >
      {{ props.node.emptyLabel }}
    </p>
  </div>
</template>
