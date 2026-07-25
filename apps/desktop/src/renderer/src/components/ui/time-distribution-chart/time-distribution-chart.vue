<!--
  TimeDistributionChart - Bar chart for time distribution

  Features:
  - Stacked bar chart (single series)
  - Internal distribution type selector (hourly/weekday/dayOfMonth)
  - Tooltip support (shadcn-vue chart tooltip)
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { cn } from '@renderer/utils/cn'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Tooltip } from '@unovis/ts'
import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig
} from '@renderer/components/ui/chart'
import { useI18n } from '@renderer/composables/use-i18n'
import type {
  DistributionType,
  TimeDistributionDataPoint,
  TimeDistributionChartProps
} from './types'

// =============================================================================
// Props & Model
// =============================================================================

const props = withDefaults(defineProps<TimeDistributionChartProps>(), {
  height: 200,
  availableTypes: () => ['hourly', 'weekday', 'dayOfMonth']
})

const distributionType = defineModel<DistributionType>('distributionType', {
  default: 'hourly'
})

const { m } = useI18n()

const distributionLabelTexts = computed(
  () =>
    props.distributionLabels ?? {
      hourly: m.value.ui.charts.hourly,
      weekday: m.value.ui.charts.weekday,
      dayOfMonth: m.value.ui.charts.dayOfMonth
    }
)

// Show selector only when multiple options available
const showTypeSelector = computed(() => props.availableTypes.length > 1)

// =============================================================================
// Computed
// =============================================================================

function formatYLabel(v: number): string {
  if (props.formatValue) return props.formatValue(v)
  return v.toFixed(1)
}

type ChartDatum = TimeDistributionDataPoint & {
  valueText: string
  fill: string
}

// Chart ink: bars are mid-size marks and run at mid density.
const chartData = computed<ChartDatum[]>(() =>
  props.data.map((d) => ({
    ...d,
    valueText: formatYLabel(d.value),
    fill: 'color-mix(in oklch, var(--chart) 70%, transparent)'
  }))
)

const chartConfig = computed(
  () => ({ valueText: { label: m.value.ui.charts.duration } }) satisfies ChartConfig
)

// Accessors
const x = (d: ChartDatum) => d.key
const y = (d: ChartDatum) => d.value
const color = (d: ChartDatum) => d.fill

// Sparse ticks so labels survive narrow side columns without colliding.
const numTicks = computed(() => {
  switch (distributionType.value) {
    case 'hourly':
      return 6
    case 'weekday':
      return 7
    case 'dayOfMonth':
      return 10
    default: {
      const _exhaustive: never = distributionType.value
      return _exhaustive
    }
  }
})

function formatLabel(key: number): string {
  const item = props.data.find((d) => d.key === key)
  return item?.label ?? ''
}

const tooltipTemplate = computed(() =>
  componentToString(chartConfig.value, ChartTooltipContent, { labelKey: 'label' })
)

// Tooltip instance for crosshair - appended to body to avoid clipping
const crosshairTooltip = shallowRef<Tooltip | null>(null)
const tooltipContainer = shallowRef<HTMLElement | null>(null)

onMounted(() => {
  tooltipContainer.value = document.body
  crosshairTooltip.value = new Tooltip({
    container: document.body,
    className: 'chart-tooltip-portal'
  })
})

onUnmounted(() => {
  crosshairTooltip.value?.destroy()
  crosshairTooltip.value = null
})

const insight = computed(() => {
  let best: TimeDistributionDataPoint | null = null
  for (const point of props.data) {
    if (point.value <= 0) continue
    if (!best || point.value > best.value) best = point
  }
  if (!best) return m.value.ui.charts.mostActiveNone
  return m.value.ui.charts.mostActive({ label: best.label, value: formatYLabel(best.value) })
})
</script>

<template>
  <div
    :class="cn('space-y-2', props.class)"
    data-slot="time-distribution-chart"
  >
    <!-- Single header row: title, insight, selector -->
    <div
      v-if="props.title || insight || showTypeSelector"
      class="flex h-7 items-center gap-2 text-xs text-muted-foreground"
    >
      <h3
        v-if="props.title"
        class="shrink-0 font-medium"
      >
        {{ props.title }}
      </h3>
      <span v-if="props.title && insight">·</span>
      <div
        v-if="insight"
        class="truncate"
        data-slot="chart-insight"
      >
        {{ insight }}
      </div>
      <div
        v-if="showTypeSelector"
        class="ml-auto"
      >
        <SegmentedControl v-model="distributionType">
          <SegmentedControlItem
            v-for="t in props.availableTypes"
            :key="t"
            :value="t"
          >
            {{ distributionLabelTexts[t] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
    </div>

    <div :style="{ height: `${props.height}px` }">
      <ChartContainer :config="chartConfig">
        <VisXYContainer
          :data="chartData"
          :duration="0"
          :clip-path-extend="6"
        >
          <VisStackedBar
            :x="x"
            :y="[y]"
            :color="color"
            :bar-padding="0.3"
            :rounded-corners="2"
          />
          <VisAxis
            type="x"
            :tick-format="formatLabel"
            :num-ticks="numTicks"
            :grid-line="false"
            :domain-line="false"
          />
          <VisAxis
            type="y"
            :tick-format="(v: number) => formatYLabel(v)"
            :domain-line="false"
          />
          <ChartTooltip
            :container="tooltipContainer!"
            class-name="chart-tooltip-portal"
          />
          <ChartCrosshair
            :x="x"
            :y="y"
            :duration="0"
            :template="tooltipTemplate"
            :color="['var(--chart)']"
            :hide-when-far-from-pointer="false"
            :tooltip="crosshairTooltip!"
          />
        </VisXYContainer>
      </ChartContainer>
    </div>
  </div>
</template>
