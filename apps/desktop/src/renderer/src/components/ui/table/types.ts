export type TableColumnAlign = 'start' | 'center' | 'end'

/**
 * Emphasis of a column's cells in table mode: `muted` de-emphasizes a secondary
 * column against its neighbours. The reflowed card ignores tone - there the
 * label carries the hierarchy and every value reads in the foreground.
 */
export type TableColumnTone = 'default' | 'muted'

/**
 * How a cell lays out once the table reflows into stacked rows: the primary
 * cell is the row's headline, meta cells become labelled lines under it, and
 * the actions cell sits to the right of the stack.
 */
export type TableColumnRole = 'primary' | 'meta' | 'actions'

/**
 * One column of a Table. The single source for the header cell, the colgroup
 * width, the alignment of head and body cells, and the label a reflowed cell
 * is prefixed with.
 */
export interface TableColumn {
  /** Header text; also the label of the reflowed cell. Omit for icon-only columns. */
  label?: string
  /** CSS width; omit (or '') for a flexible column. */
  width?: string
  /** Horizontal alignment of the head and its cells. */
  align?: TableColumnAlign
  /** Cell emphasis in table mode. */
  tone?: TableColumnTone
  /** Reflow role; the first column defaults to `primary`, the rest to `meta`. */
  role?: TableColumnRole
}
