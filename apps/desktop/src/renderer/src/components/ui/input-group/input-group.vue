<!-- InputGroup container component -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  /** Control size step; the group sizes its inner input with it. */
  size?: 'default' | 'sm'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { size: 'default' })
</script>

<template>
  <div
    data-slot="input-group"
    role="group"
    :data-size="props.size"
    :class="
      cn(
        'group/input-group relative flex w-full items-center rounded-md border border-border bg-input transition-colors',
        'h-7 min-w-0 has-[>textarea]:h-auto',
        props.size === 'sm' && 'h-6 [&>input]:h-full [&>input]:text-xs',

        // Variants based on alignment
        'has-[>[data-align=inline-start]]:[&>input]:pl-2',
        'has-[>[data-align=inline-end]]:[&>input]:pr-2',
        'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
        'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',

        // Focus state - only border color change
        'has-[[data-slot=input-group-control]:focus]:border-primary',

        // Error state
        'has-[[data-slot][aria-invalid=true]]:border-destructive',

        props.class
      )
    "
  >
    <slot />
  </div>
</template>
