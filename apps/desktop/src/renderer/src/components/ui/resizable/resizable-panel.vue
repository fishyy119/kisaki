<!-- Resizable Panel component -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { useResizable } from './use-resizable'
import { cn } from '@renderer/utils/cn'

interface Props {
  position: 'left' | 'right'
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const context = useResizable()

const panelStyle = computed(() =>
  props.position === 'left' ? { width: `${context.leftWidthPx}px` } : undefined
)
</script>

<template>
  <div
    :class="cn('shrink-0 overflow-hidden', props.position === 'right' && 'flex-1', props.class)"
    :style="panelStyle"
    data-slot="resizable-panel"
  >
    <slot />
  </div>
</template>
