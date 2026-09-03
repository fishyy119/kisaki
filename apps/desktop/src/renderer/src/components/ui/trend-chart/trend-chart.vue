<!--
  TrendChart - Time series line/area chart with granularity selector

  Features:
  - Line chart with area fill
  - Internal granularity selector (daily/weekly/monthly)
  - Tooltip support (shadcn-vue chart tooltip)
  - X-axis tick count follows the plot width, so labels never collide
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { remToPx } from '@renderer/core/interface-scale'
import { cn } from '@renderer/utils/cn'
import {
  toLocalDateKey,
  toLocalWeekKey,
  toLocalMonthKey,
  parseLocalDateKey
} from '@renderer/utils/datetime'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Tooltip } from '@unovis/ts'
import { VisXYContainer, VisLine, VisAxis, VisArea } from '@unovis/vue'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig
} from '@renderer/components/ui/chart'
import type { TrendChartProps, TrendGranularity } from './types'
import { useI18n } from '@renderer/composables/use-i18n'

// =============================================================================
// Props & Model
// =============================================================================

const props = withDefaults(defineProps<TrendChartProps>(), {
  height: '14rem',
  availableGranularities: () => ['daily', 'weekly', 'monthly']
})

const granularity = defineModel<TrendGranularity>('granularity', {
  default: 'daily'
})

const { m, f } = useI18n()

const granularityLabelTexts = computed(
  () =>
    props.granularityLabels ?? {
      daily: m.value.ui.charts.day,
      weekly: m.value.ui.charts.week,
      monthly: m.value.ui.charts.month
    }
)

// Show selector only when multiple options available
const showGranularitySelector = computed(() => props.availableGranularities.length > 1)

// =============================================================================
// Chart Config (shadcn-vue)
// =============================================================================

const chartConfig = computed(
  () =>
    ({
      valueText: {
        label: m.value.ui.charts.duration,
        color: 'var(--chart)'
      }
    }) satisfies ChartConfig
)

// =============================================================================
// Range & Data Normalization (range-driven, like Heatmap)
// =============================================================================

interface TrendChartSeriesPoint {
  date: Date
  dateKey: string
  value: number
  valueText: string
  label: string
}

const range = computed(() => {
  const start = new Date(props.range.start)
  const end = new Date(props.range.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (end < start) return null

  return { start, end }
})

function parseInputDate(input: string): Date | null {
  const parsed = parseLocalDateKey(input)
  if (parsed) return parsed
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

const valueMap = computed(() => {
  const map = new Map<string, number>()
  for (const point of props.data) {
    const date = parseInputDate(point.date)
    if (!date) continue

    if (range.value) {
      const day = new Date(date)
      day.setHours(0, 0, 0, 0)
      if (day < range.value.start || day > range.value.end) continue
    }

    let key: string
    switch (granularity.value) {
      case 'weekly':
        key = toLocalWeekKey(date)
        break
      case 'monthly':
        key = toLocalMonthKey(date)
        break
      default:
        key = toLocalDateKey(date)
    }

    map.set(key, (map.get(key) ?? 0) + point.value)
  }
  return map
})

function formatYLabel(v: number): string {
  if (props.formatValue) return props.formatValue(v)
  return v.toFixed(1)
}

function formatTooltipLabel(date: Date): string {
  if (granularity.value === 'weekly') {
    const weekEnd = new Date(date)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return f.value.monthDayRange(date, weekEnd)
  }
  if (granularity.value === 'monthly') {
    return f.value.yearMonth(date)
  }
  return f.value.date(date)
}

const series = computed<TrendChartSeriesPoint[]>(() => {
  if (!range.value) return []
  const rangeStart = range.value.start
  const rangeEnd = range.value.end

  const points: Array<Omit<TrendChartSeriesPoint, 'valueText' | 'label'>> = []

  if (granularity.value === 'daily') {
    const current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    const end = new Date(rangeEnd)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const dateKey = toLocalDateKey(current)
      points.push({
        date: new Date(current),
        dateKey,
        value: valueMap.value.get(dateKey) ?? 0
      })
      current.setDate(current.getDate() + 1)
    }
  } else if (granularity.value === 'weekly') {
    const current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    current.setDate(current.getDate() - ((current.getDay() + 6) % 7))

    const end = new Date(rangeEnd)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const weekKey = toLocalWeekKey(current)
      points.push({
        date: new Date(current),
        dateKey: weekKey,
        value: valueMap.value.get(weekKey) ?? 0
      })
      current.setDate(current.getDate() + 7)
    }
  } else {
    const current = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const end = new Date(rangeEnd)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const monthKey = toLocalMonthKey(current)
      points.push({
        date: new Date(current),
        dateKey: monthKey,
        value: valueMap.value.get(monthKey) ?? 0
      })
      current.setMonth(current.getMonth() + 1)
    }
  }

  return points.map((p) => ({
    ...p,
    valueText: formatYLabel(p.value),
    label: formatTooltipLabel(p.date)
  }))
})

const canRender = computed(() => range.value !== null && series.value.length > 0)

// Accessors
const x = (_d: TrendChartSeriesPoint, i: number) => i
const y = (d: TrendChartSeriesPoint) => d.value

// One label needs about 4.5rem ("Jan 2026", "12/31") plus breathing room; the
// count follows the measured plot width so labels never collide at any
// width or scale. At least two ticks frame the range.
const plotRef = useTemplateRef<HTMLElement>('plot')
const { width: plotWidth } = useElementSize(plotRef)
const TICK_SLOT_REM = 4.5

const numTicks = computed(() => {
  const fitting = Math.floor(plotWidth.value / remToPx(TICK_SLOT_REM))
  return Math.max(2, Math.min(series.value.length, fitting))
})

function formatXLabel(i: number): string {
  const idx = Math.round(i)
  const item = series.value[idx]
  if (!item) return ''

  if (props.formatDate) return props.formatDate(item.dateKey, granularity.value)

  switch (granularity.value) {
    case 'daily':
      return `${item.date.getMonth() + 1}/${item.date.getDate()}`
    case 'weekly':
      return `${item.date.getMonth() + 1}/${item.date.getDate()}`
    case 'monthly':
      return `${item.date.getFullYear()}/${item.date.getMonth() + 1}`
  }
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
  if (!canRender.value) return ''
  let best: TrendChartSeriesPoint | null = null
  for (const point of series.value) {
    if (point.value <= 0) continue
    if (!best || point.value > best.value) best = point
  }
  if (!best) return m.value.ui.charts.peakNone
  return m.value.ui.charts.peak({ label: best.label, value: best.valueText })
})
</script>

<template>
  <div
    :class="cn('space-y-2', props.class)"
    data-slot="trend-chart"
  >
    <!-- Single header row: title, insight, selector -->
    <div
      v-if="props.title || insight || showGranularitySelector"
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
        v-if="showGranularitySelector"
        class="ml-auto"
      >
        <SegmentedControl v-model="granularity">
          <SegmentedControlItem
            v-for="g in props.availableGranularities"
            :key="g"
            :value="g"
          >
            {{ granularityLabelTexts[g] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
    </div>

    <div
      v-if="canRender"
      ref="plot"
      :style="{ height: props.height }"
    >
      <ChartContainer :config="chartConfig">
        <VisXYContainer
          :data="series"
          :duration="0"
          :clip-path-extend="6"
        >
          <VisArea
            :x="x"
            :y="y"
            color="var(--chart)"
            :opacity="0.2"
          />
          <VisLine
            :x="x"
            :y="y"
            color="var(--chart)"
          />
          <VisAxis
            type="x"
            :tick-format="formatXLabel"
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
