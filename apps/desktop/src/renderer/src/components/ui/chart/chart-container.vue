<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useId } from 'reka-ui'
import { toRefs } from 'vue'
import { cn } from '@renderer/utils/cn'
import { provideChartContext, type ChartConfig } from '.'

const props = defineProps<{
  id?: HTMLAttributes['id']
  class?: HTMLAttributes['class']
  config: ChartConfig
}>()

defineSlots<{
  default: {
    id: string
    config: ChartConfig
  }
}>()

const { config } = toRefs(props)
const uniqueId = useId()

provideChartContext({
  id: uniqueId,
  config
})
</script>

<template>
  <div
    data-slot="chart"
    :class="
      cn(
        `flex flex-col justify-center text-xs h-full w-full [&_.tick_text]:!fill-muted-foreground [&_.tick_line]:!stroke-border/50 [&_[data-vis-xy-container]]:h-full [&_[data-vis-xy-container]]:w-full [&_[data-vis-single-container]]:h-full [&_[data-vis-single-container]]:w-full [&_svg]:overflow-visible`,
        props.class
      )
    "
    :style="{
      '--vis-tooltip-padding': '0px',
      '--vis-tooltip-background-color': 'transparent',
      '--vis-tooltip-border-color': 'transparent',
      '--vis-tooltip-text-color': 'none',
      '--vis-tooltip-shadow-color': 'none',
      '--vis-tooltip-backdrop-filter': 'none',
      '--vis-crosshair-circle-stroke-color': '#0000',
      '--vis-crosshair-line-stroke-width': '0px',
      '--vis-axis-grid-line-dasharray': '3 3',
      '--vis-axis-grid-color': 'var(--border)',
      '--vis-font-family': 'var(--font-sans)'
    }"
  >
    <slot
      :id="uniqueId"
      :config="config"
    />
  </div>
</template>
