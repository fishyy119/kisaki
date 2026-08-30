/**
 * Raw database change contracts.
 *
 * `RawDbChange` is the main-process shape produced by SQLite triggers; row
 * snapshots never leave the main process. `DbChangeSummary` is the bounded
 * renderer-facing projection pushed over the `db:changed` IPC channel.
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
