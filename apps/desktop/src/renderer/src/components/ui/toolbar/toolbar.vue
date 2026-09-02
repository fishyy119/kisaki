<!--
  Toolbar
  Band strip under a page or dialog header. Carries the band fill and stacks
  ToolbarRows: a scope row (tabs) above a query row (search, filters, sort).
  Operations never live here; they belong to header actions or dialog footers.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="toolbar"
    :class="
      cn('flex shrink-0 flex-col gap-2 border-b border-border bg-muted/30 px-4 py-2', props.class)
    "
  >
    <slot />
  </div>
</template>
