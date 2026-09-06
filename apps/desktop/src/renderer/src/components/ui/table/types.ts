export type TableColumnAlign = 'start' | 'center' | 'end'

/** Standard management rows or compact search and preview rows. */
export type TableDensity = 'standard' | 'compact'

/** Emphasis of a column's values. */
export type TableColumnTone = 'default' | 'muted'

/**
 * One field of a Table. Supporting fields belong in other columns or details,
 * never on a secondary line inside the cell.
 */
export interface TableColumn {
  /** Header text. Omit for icon-only controls. */
  label?: string
  /** CSS width; omit (or '') for a flexible column. */
  width?: string
  /** Horizontal alignment of the head and its cells. */
  align?: TableColumnAlign
  /** Cell emphasis. */
  tone?: TableColumnTone
}
