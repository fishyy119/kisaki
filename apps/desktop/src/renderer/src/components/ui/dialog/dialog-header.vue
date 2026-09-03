<!--
  DialogHeader - Identity strip of the slab: title (and description) only.
  Reserves the top-right corner for the close button and never shrinks when
  the body scrolls.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="dialog-header"
    :class="
      cn('shrink-0 rounded-t-md border-b border-border bg-muted/30 py-3 pr-10 pl-4', props.class)
    "
  >
    <slot />
  </div>
</template>
