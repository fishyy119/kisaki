/**
 * Raw database change contracts.
 *
 * `RawDbChange` is the main-process shape produced by SQLite triggers; row
 * snapshots never leave the main process. `DbChangeSummary` is the bounded
 * renderer-facing projection pushed over the `db:changed` IPC channel: the
 * row's table, id, and operation.
 */

import type { TableName } from './table-names'

export type RawDbChangeOperation = 'inserted' | 'updated' | 'deleted'

export interface RawDbChange {
  operation: RawDbChangeOperation
  table: TableName
  id: string
  old?: Record<string, unknown>
  next?: Record<string, unknown>
  occurredAt: number
  /** Writer attribution: `app` or `extension:<id>`; see db/actor. */
  actor: string
}

export interface DbChangeSummary {
  operation: RawDbChangeOperation
  table: TableName
  id: string
  occurredAt: number
}

export function toDbChangeSummary(change: RawDbChange): DbChangeSummary {
  return {
    operation: change.operation,
    table: change.table,
    id: change.id,
    occurredAt: change.occurredAt
  }
}

/**
 * One `db:changed` push, with the touched tables pre-aggregated so a
 * subscriber decides in O(1) whether it cares.
 */
export interface DbChangeBatch {
  /** Change summaries in feed order. */
  readonly changes: readonly DbChangeSummary[]
  /** Every table the batch touched, deduplicated. */
  readonly tables: ReadonlySet<TableName>
}

export function aggregateDbChanges(changes: readonly DbChangeSummary[]): DbChangeBatch {
  const tables = new Set<TableName>()
  for (const change of changes) tables.add(change.table)
  return { changes, tables }
}

/** True when the batch touched any of the given tables. */
export function batchTouchesAny(batch: DbChangeBatch, tables: Iterable<TableName>): boolean {
  for (const table of tables) {
    if (batch.tables.has(table)) return true
  }
  return false
}
