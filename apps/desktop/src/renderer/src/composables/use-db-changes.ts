/**
 * Db change feed subscription composable
 *
 * Invokes the handler once per `db:changed` batch, with the touched tables
 * pre-aggregated. Queries do not use this: their invalidation is declared
 * (`invalidate.tables`) and evaluated by the query kernel. This is for the
 * reactions that are not a reload: closing a dialog whose row was deleted,
 * leaving a detail route, updating a store.
 */

import { batchTouchesAny, type DbChangeBatch } from '@shared/db/changes'
import { subscribeDbChanges } from '@renderer/core/query'
import { onScopeDispose } from 'vue'

export { batchTouchesAny }
export type { DbChangeBatch }

export function useDbChanges(handler: (batch: DbChangeBatch) => void): void {
  onScopeDispose(subscribeDbChanges(handler))
}
