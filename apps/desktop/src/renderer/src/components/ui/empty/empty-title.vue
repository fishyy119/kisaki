<!-- EmptyTitle component -->
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
    data-slot="empty-title"
    :class="cn('text-lg font-medium tracking-tight', props.class)"
  >
    <slot />
  </div>
</template>
