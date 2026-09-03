<!--
  DialogFooter - Action strip of the slab. Caps scrolled content and never
  shrinks when the body scrolls.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="dialog-footer"
    :class="
      cn(
        'flex shrink-0 justify-end gap-2 rounded-b-md border-t border-border bg-muted/30 px-4 py-3',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>
