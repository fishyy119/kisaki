import type { HTMLAttributes } from 'vue'

export type DistributionType = 'hourly' | 'weekday' | 'dayOfMonth'

export interface TimeDistributionDataPoint {
  key: number
  label: string
  value: number
}

export interface TimeDistributionChartProps {
  /** Module title rendered inline in the chart header row */
  title?: string
  /** Data points to display */
  data: TimeDistributionDataPoint[]
  /** Available distribution types (defaults to all). Selector hidden when only one. */
  availableTypes?: DistributionType[]
  /** Custom value formatter for y-axis and tooltip */
  formatValue?: (value: number) => string
  /** Distribution type selector labels */
  distributionLabels?: { hourly: string; weekday: string; dayOfMonth: string }
  /** Plot height as a CSS length (rem, so it follows the interface scale) */
  height?: string
  /** Custom class */
  class?: HTMLAttributes['class']
}
