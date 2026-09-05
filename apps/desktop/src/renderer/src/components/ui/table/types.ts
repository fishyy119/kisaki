export type TableColumnAlign = 'start' | 'center' | 'end'

/**
 * Emphasis of a column's values. A muted column still represents its own field.
 */
export type TableColumnTone = 'default' | 'muted'

/**
 * One field of a Table. Every column follows the same rule: one value with no
 * secondary information line. Supporting fields belong in other columns or details.
 */
export interface TableColumn {
  /** Header text. Omit for icon-only controls. */
  label?: string
  /** CSS width. Omit for a flexible column. */
  width?: string
  /** Horizontal alignment of the head and its cells. */
  align?: TableColumnAlign
  /** Cell emphasis. */
  tone?: TableColumnTone
}
