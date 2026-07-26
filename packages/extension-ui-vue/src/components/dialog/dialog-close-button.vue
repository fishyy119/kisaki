<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'
import { Icon } from '../icon'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <button
    type="button"
    data-slot="dialog-close-button"
    :class="
      cn(
        'absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-primary flex items-center justify-center',
        props.class
      )
    "
  >
    <Icon
      icon="icon-[mdi--close]"
      class="size-4"
    />
    <span class="sr-only">Close</span>
  </button>
</template>
