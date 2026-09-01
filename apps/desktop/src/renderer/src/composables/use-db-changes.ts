/**
 * Db change feed subscription composable
 *
 * Subscribes to the batched `db:changed` push from the main-process change
 * feed and invokes the handler once per batch, with the touched tables
 * pre-aggregated into a set. Callers test `batch.tables` (O(1)) to decide
 * whether to invalidate, and only scan `batch.changes` when they need
 * per-row facts (id, operation); either way they act at most once per batch.
 */

import { useIpc } from './use-ipc'
import type { DbChangeSummary } from '@shared/db/changes'
import type { TableName } from '@shared/db/table-names'

export interface DbChangeBatch {
  /** Change summaries in feed order. */
  readonly changes: readonly DbChangeSummary[]
  /** Every table the batch touched, deduplicated. */
  readonly tables: ReadonlySet<TableName>
}

export function useDbChanges(handler: (batch: DbChangeBatch) => void): void {
  useIpc('db:changed', (_e, changes) => {
    if (changes.length === 0) return

    const tables = new Set<TableName>()
    for (const change of changes) {
      tables.add(change.table)
    }
    handler({ changes, tables })
  })
}

/** True when the batch touched any of the given tables. */
export function batchTouchesAny(batch: DbChangeBatch, tables: Iterable<TableName>): boolean {
  for (const table of tables) {
    if (batch.tables.has(table)) return true
  }
  return false
}
