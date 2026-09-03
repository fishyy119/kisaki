<!-- SegmentedControlItem - single option in a segmented control -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsTrigger } from '@renderer/components/ui/tabs'

interface Props {
  value: string
  disabled?: boolean
  icon?: string
  label?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <TabsTrigger
    :value="props.value"
    :disabled="props.disabled"
    :icon="props.icon"
    :label="props.label"
    :class="props.class"
    data-slot="segmented-control-item"
  >
    <slot />
  </TabsTrigger>
</template>
