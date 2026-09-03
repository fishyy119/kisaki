/**
 * Raw database change contracts.
 *
 * `RawDbChange` is the main-process shape produced by SQLite triggers; row
 * snapshots never leave the main process. `DbChangeSummary` is the bounded
 * renderer-facing projection pushed over the `db:changed` IPC channel: the
 * row's table, id, operation, and the entity targets the row points at.
 */

import type { AllEntityType } from '../entity-types'
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

/**
 * An entity a changed row is attributed to: the entity row itself, or an
 * entity one of the row's foreign keys points at (both the old and the new
 * value when the key moved). Derived from the schema, never hand-listed.
 */
export interface DbChangeTarget {
  entity: AllEntityType
  id: string
}

export interface DbChangeSummary {
  operation: RawDbChangeOperation
  table: TableName
  id: string
  occurredAt: number
  targets: readonly DbChangeTarget[]
}

/**
 * One `db:changed` push, with the touched tables and the attributed targets
 * pre-aggregated so subscribers decide in O(1) whether they care.
 */
export interface DbChangeBatch {
  /** Change summaries in feed order. */
  readonly changes: readonly DbChangeSummary[]
  /** Every table the batch touched, deduplicated. */
  readonly tables: ReadonlySet<TableName>
  /** Every entity the batch is attributed to, keyed by entity kind. */
  readonly targets: ReadonlyMap<AllEntityType, ReadonlySet<string>>
}

export function aggregateDbChanges(changes: readonly DbChangeSummary[]): DbChangeBatch {
  const tables = new Set<TableName>()
  const targets = new Map<AllEntityType, Set<string>>()

  for (const change of changes) {
    tables.add(change.table)
    for (const target of change.targets) {
      let ids = targets.get(target.entity)
      if (!ids) {
        ids = new Set<string>()
        targets.set(target.entity, ids)
      }
      ids.add(target.id)
    }
  }

  return { changes, tables, targets }
}

/** True when the batch touched any of the given tables. */
export function batchTouchesAny(batch: DbChangeBatch, tables: Iterable<TableName>): boolean {
  for (const table of tables) {
    if (batch.tables.has(table)) return true
  }
  return false
}
