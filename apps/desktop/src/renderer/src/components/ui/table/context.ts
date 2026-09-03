import type { ComputedRef, InjectionKey } from 'vue'
import type { TableColumn } from './types'

/** Column definitions of the enclosing Table. */
export const TableColumnsKey: InjectionKey<ComputedRef<readonly TableColumn[]>> =
  Symbol('TableColumns')

/**
 * Per-row cell counter. Cells claim their column index in creation order,
 * which is template order; a row's cells are therefore static - toggle
 * content inside a cell, never the cell itself.
 */
export interface TableRowCells {
  claim(): number
}

export const TableRowCellsKey: InjectionKey<TableRowCells> = Symbol('TableRowCells')
