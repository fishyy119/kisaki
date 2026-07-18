<!--
  Heatmap - Responsive activity heatmap

  Features:
  - Fixed-height chart area (width auto)
  - Best-fit grid packing to maximize cell size
  - Granularity selection (day/week/month)
  - Tooltip support (shadcn-vue chart tooltip)
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { cn } from '@renderer/utils/cn'
import { toLocalDateKey, toLocalWeekKey, toLocalMonthKey } from '@renderer/utils/datetime'
import { SingleContainer, Tooltip } from '@unovis/ts'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import {
  ChartContainer,
  ChartTooltipContent,
  componentToString,
  type ChartConfig
} from '@renderer/components/ui/chart'
import { HeatmapRectGrid, HeatmapRectGridSelectors } from './heatmap-grid'
import type { HeatmapGranularity, HeatmapProps } from './types'

// =============================================================================
// Props & Model
// =============================================================================

const props = withDefaults(defineProps<HeatmapProps>(), {
  height: 100,
  showLegend: true,
  legendLabels: () => ({ less: 'Less', more: 'More' }),
  granularityLabels: () => ({ day: '日', week: '周', month: '月' }),
  availableGranularities: () => ['day', 'week', 'month']
})

const granularity = defineModel<HeatmapGranularity>('granularity', {
  default: 'day'
})

// Show selector only when multiple options available
const showGranularitySelector = computed(() => props.availableGranularities.length > 1)

// =============================================================================
// Range
// =============================================================================

const range = computed(() => {
  const start = new Date(props.range.start)
  const end = new Date(props.range.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end < start) return null

  return { start, end }
})

// =============================================================================
// Chart Config (shadcn-vue tooltip)
// =============================================================================

const chartConfig = {
  valueText: { label: '时长' }
} satisfies ChartConfig

const tooltipTemplate = componentToString(chartConfig, ChartTooltipContent, { labelKey: 'label' })

// =============================================================================
// Helpers
// =============================================================================

// Relative intensity (GitHub-style): non-zero cells are bucketed against the
// current view's maximum, so every granularity differentiates instead of
// saturating on absolute day-scale thresholds.
function getIntensityLevel(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0
  const ratio = value / maxValue
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function getCellFill(level: number): string {
  switch (level) {
    case 4:
      return 'var(--chart)'
    case 3:
      return 'color-mix(in oklch, var(--chart) 60%, transparent)'
    case 2:
      return 'color-mix(in oklch, var(--chart) 40%, transparent)'
    case 1:
      return 'color-mix(in oklch, var(--chart) 20%, transparent)'
    default:
      return 'var(--color-muted)'
  }
}

function formatDateDisplay(date: Date): string {
  if (props.formatDate) return props.formatDate(date, granularity.value)
  switch (granularity.value) {
    case 'week': {
      const weekEnd = new Date(date)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return `${date.toLocaleDateString('zh-Hans', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('zh-Hans', { month: 'short', day: 'numeric' })}`
    }
    case 'month':
      return date.toLocaleDateString('zh-Hans', { year: 'numeric', month: 'long' })
    default:
      return date.toLocaleDateString('zh-Hans', { year: 'numeric', month: 'short', day: 'numeric' })
  }
}

function formatValueDisplay(value: number): string {
  if (props.formatValue) return props.formatValue(value)
  if (value === 0) return '无活动'
  const hours = Math.floor(value / 3600000)
  const minutes = Math.floor((value % 3600000) / 60000)
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

// =============================================================================
// Data Transformation (range-driven cells)
// =============================================================================

interface HeatmapCell {
  date: Date
  dateKey: string
  value: number
  level: number
}

const valueMap = computed(() => {
  const map = new Map<string, number>()
  for (const point of props.data) {
    let key: string
    switch (granularity.value) {
      case 'week':
        key = toLocalWeekKey(point.date)
        break
      case 'month':
        key = toLocalMonthKey(point.date)
        break
      default:
        key = toLocalDateKey(point.date)
    }
    map.set(key, (map.get(key) ?? 0) + point.value)
  }
  return map
})

const cells = computed<HeatmapCell[]>(() => {
  if (!range.value) return []
  const rangeStart = range.value.start
  const rangeEnd = range.value.end

  const out: Array<Omit<HeatmapCell, 'level'>> = []

  if (granularity.value === 'day') {
    const current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    const end = new Date(rangeEnd)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const dateKey = toLocalDateKey(current)
      out.push({
        date: new Date(current),
        dateKey,
        value: valueMap.value.get(dateKey) ?? 0
      })
      current.setDate(current.getDate() + 1)
    }
  } else if (granularity.value === 'week') {
    const current = new Date(rangeStart)
    current.setHours(0, 0, 0, 0)
    current.setDate(current.getDate() - ((current.getDay() + 6) % 7))

    const end = new Date(rangeEnd)
    end.setHours(0, 0, 0, 0)

    while (current <= end) {
      const weekKey = toLocalWeekKey(current)
      out.push({
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
      out.push({
        date: new Date(current),
        dateKey: monthKey,
        value: valueMap.value.get(monthKey) ?? 0
      })
      current.setMonth(current.getMonth() + 1)
    }
  }

  const maxValue = out.reduce((max, cell) => Math.max(max, cell.value), 0)
  return out.map((cell) => ({ ...cell, level: getIntensityLevel(cell.value, maxValue) }))
})

interface HeatmapChartDatum extends HeatmapCell {
  label: string
  valueText: string
  fill: string
}

const chartData = computed<HeatmapChartDatum[]>(() =>
  cells.value.map((cell) => ({
    ...cell,
    label: formatDateDisplay(cell.date),
    valueText: formatValueDisplay(cell.value),
    fill: getCellFill(cell.level)
  }))
)

// =============================================================================
// Unovis
// =============================================================================

const containerEl = ref<HTMLDivElement | null>(null)

let unovisContainer: SingleContainer<HeatmapChartDatum[]> | null = null
let unovisTooltip: Tooltip | null = null
let gridComponent: HeatmapRectGrid<HeatmapChartDatum> | null = null

function destroyUnovis() {
  unovisContainer?.destroy()
  unovisContainer = null
  unovisTooltip?.destroy()
  unovisTooltip = null
  gridComponent?.destroy()
  gridComponent = null
}

function initUnovis() {
  destroyUnovis()

  if (!containerEl.value) return

  gridComponent = new HeatmapRectGrid<HeatmapChartDatum>({
    id: (d: HeatmapChartDatum) => d.dateKey,
    fill: (d: HeatmapChartDatum) => d.fill,
    cursor: 'default',
    gapRem: 0.25,
    cornerRadiusRem: 0.125,
    shapeRendering: 'auto'
  })

  unovisTooltip = new Tooltip({
    container: document.body,
    className: 'chart-tooltip-portal',
    triggers: {
      [HeatmapRectGridSelectors.cell]: tooltipTemplate!
    }
  })

  unovisContainer = new SingleContainer(
    containerEl.value,
    {
      component: gridComponent,
      tooltip: unovisTooltip,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    chartData.value
  )
}

onMounted(() => {
  if (containerEl.value) {
    initUnovis()
  }
})

onUnmounted(() => {
  destroyUnovis()
})

// Reinitialize when chartData changes to ensure grid is properly updated
// Use flush: 'post' to ensure DOM is updated before accessing containerEl
watch(
  chartData,
  () => {
    if (containerEl.value) {
      initUnovis()
    }
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    :class="cn('space-y-2', props.class)"
    data-slot="heatmap"
  >
    <!-- Single header row: title and selector (totals live in the page hero) -->
    <div
      v-if="props.title || showGranularitySelector"
      class="flex h-7 items-center gap-2 text-xs text-muted-foreground"
    >
      <h3
        v-if="props.title"
        class="shrink-0 font-medium"
      >
        {{ props.title }}
      </h3>
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
            {{ props.granularityLabels[g] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
    </div>

    <div :style="{ height: `${props.height}px` }">
      <ChartContainer :config="chartConfig">
        <div
          ref="containerEl"
          class="h-full w-full"
        />
      </ChartContainer>
    </div>

    <div
      v-if="props.showLegend"
      class="flex items-center justify-end gap-2 text-xs text-muted-foreground"
    >
      <span>{{ props.legendLabels.less }}</span>
      <div class="flex gap-1">
        <div
          v-for="level in 5"
          :key="level"
          class="size-2.5 rounded-sm"
          :style="{ backgroundColor: getCellFill(level - 1) }"
        />
      </div>
      <span>{{ props.legendLabels.more }}</span>
    </div>
  </div>
</template>
