import type { TableDensity } from './types'

/** Standard virtualized rows share this height with their layout estimates. */
export const TABLE_DENSITIES = {
  standard: { textClass: 'text-sm', headerClass: 'h-8', rowHeightRem: 2.5 },
  compact: { textClass: 'text-xs', headerClass: 'h-7', rowHeightRem: null }
} as const satisfies Record<
  TableDensity,
  { textClass: string; headerClass: string; rowHeightRem: number | null }
>
