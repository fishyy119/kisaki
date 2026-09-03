<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

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
