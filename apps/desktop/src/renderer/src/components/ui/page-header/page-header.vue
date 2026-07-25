<!-- Page header bar: fixed-height surface strip with left content and right actions -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <header
    data-slot="page-header"
    :class="
      cn(
        'shrink-0 flex h-12 items-center gap-3 border-b border-border bg-surface px-4',
        props.class
      )
    "
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <slot />
    </div>

    <div
      v-if="$slots.actions"
      class="flex shrink-0 items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
