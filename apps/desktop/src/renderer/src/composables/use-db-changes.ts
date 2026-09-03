/**
 * Db change feed subscription composable
 *
 * Subscribes to the batched `db:changed` push from the main-process change
 * feed and invokes the handler once per batch, with the touched tables and
 * the attributed entity targets pre-aggregated. Route page data does not use
 * this: its invalidation is declared on the resource and evaluated by the
 * route-data kernel. This is for surfaces that live outside routes (dialogs,
 * persistent panels, stores).
 */

import {
  aggregateDbChanges,
  batchTouchesAny,
  type DbChangeBatch,
  type DbChangeTarget
} from '@shared/db/changes'
import { useIpc } from './use-ipc'

export { batchTouchesAny }
export type { DbChangeBatch, DbChangeTarget }

export function useDbChanges(handler: (batch: DbChangeBatch) => void): void {
  useIpc('db:changed', (_e, changes) => {
    if (changes.length === 0) return
    handler(aggregateDbChanges(changes))
  })
}

/** True when the batch is attributed to the given entity. */
export function batchTouchesEntity(
  batch: DbChangeBatch,
  entity: DbChangeTarget['entity'],
  id: string
): boolean {
  return batch.targets.get(entity)?.has(id) ?? false
}
