<!--
  TableCell - A body or footer cell. Claims its column from the enclosing row
  and takes the column's alignment, reflow role, and label from the Table's
  column definitions, so call sites write content only.
-->
<script setup lang="ts">
import { computed, inject, type HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'
import { TableColumnsKey, TableRowCellsKey } from './context'
import type { TableColumnAlign, TableColumnRole } from './types'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const columns = inject(TableColumnsKey, null)
const index = inject(TableRowCellsKey, null)?.claim() ?? 0
const column = computed(() => columns?.value[index])

const ALIGN_CLASSES: Record<TableColumnAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right'
}

const role = computed<TableColumnRole>(
  () => column.value?.role ?? (index === 0 ? 'primary' : 'meta')
)
</script>

<template>
  <td
    data-slot="table-cell"
    :data-role="role"
    :data-label="column?.label"
    :class="
      cn(
        'py-1.5 px-2 align-middle [&:has([role=checkbox])]:pr-0',
        column?.align && ALIGN_CLASSES[column.align],
        column?.tone === 'muted' && 'text-muted-foreground',
        props.class
      )
    "
  >
    <slot />
  </td>
</template>
