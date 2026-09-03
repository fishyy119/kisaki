<!-- AlertDialog header component -->
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
    :class="cn('shrink-0 rounded-t-md border-b border-border bg-muted/30 px-4 py-3', props.class)"
    data-slot="alert-dialog-header"
  >
    <slot />
  </div>
</template>
