/**
 * Db change feed subscription composable
 *
 * Subscribes to the batched `db:changed` push from the main-process change
 * feed and invokes the handler once per change summary. Callers branch on
 * `change.operation` and `change.table` to invalidate their local state.
 */

import { useIpc } from './use-ipc'
import type { DbChangeSummary } from '@shared/db/changes'

export function useDbChanges(handler: (change: DbChangeSummary) => void): void {
  useIpc('db:changed', (_e, changes) => {
    for (const change of changes) {
      handler(change)
    }
  })
}
