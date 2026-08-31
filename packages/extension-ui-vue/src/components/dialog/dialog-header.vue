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
    :class="cn('rounded-t-md border-b border-border bg-muted/30 px-4 py-3', props.class)"
  >
    <slot />
  </div>
</template>
