import type { HTMLAttributes } from 'vue'

export interface RankingListItem {
  id: string
  name: string
  /** Metric value; items must be sorted descending by the caller */
  value: number
  /** Formatted value for display */
  valueText: string
  /** Cover thumbnail URL */
  coverUrl?: string
  /** Iconify class fallback when no cover is available */
  icon?: string
}

export interface RankingListProps {
  /** Items sorted descending by value */
  items: RankingListItem[]
  /**
   * Share denominator. Defaults to the sum of item values; pass the true
   * period total when items overlap (e.g. one session counts under several
   * tags) so per-row shares stay meaningful.
   */
  totalValue?: number
  /** Rows shown inline before the "view all" dialog takes over */
  maxItems?: number
  /**
   * Inline column count. With 2, rows flow top-down then into the second
   * column (1-4 left, 5-8 right); the full-list dialog stays single-column.
   */
  columns?: 1 | 2
  /** Title of the full-list dialog */
  expandTitle?: string
  class?: HTMLAttributes['class']
}
