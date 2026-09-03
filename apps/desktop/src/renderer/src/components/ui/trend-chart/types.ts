import type { HTMLAttributes } from 'vue'

export type TrendGranularity = 'daily' | 'weekly' | 'monthly'

export interface TrendChartDataPoint {
  date: string
  value: number
}

export interface TrendChartProps {
  /** Module title rendered inline in the chart header row */
  title?: string
  /** Time range this trend represents */
  range: { start: Date; end: Date }
  /** Data points to display */
  data: TrendChartDataPoint[]
  /** Available granularities (defaults to all). Selector hidden when only one. */
  availableGranularities?: TrendGranularity[]
  /** Custom value formatter for y-axis and tooltip */
  formatValue?: (value: number) => string
  /** Custom date formatter for x-axis */
  formatDate?: (date: string, granularity: TrendGranularity) => string
  /** Granularity selector labels */
  granularityLabels?: { daily: string; weekly: string; monthly: string }
  /** Plot height as a CSS length (rem, so it follows the interface scale) */
  height?: string
  /** Custom class */
  class?: HTMLAttributes['class']
}
