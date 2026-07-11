<!-- CollapsibleGroupCount - Item count display -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <span
    data-slot="collapsible-group-count"
    :class="cn('tabular-nums opacity-50', props.class)"
  >
    <slot />
  </span>
</template>
