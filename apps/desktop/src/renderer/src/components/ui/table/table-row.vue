<script setup lang="ts">
import { provide, type HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'
import { TableRowCellsKey } from './context'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

let claimed = 0
provide(TableRowCellsKey, { claim: () => claimed++ })
</script>

<template>
  <tr
    data-slot="table-row"
    :class="
      cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', props.class)
    "
  >
    <slot />
  </tr>
</template>
