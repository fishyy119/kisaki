import type { DbHooks } from '@main/services/db/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds db module library hooks to their public hook points. */
export function bindLibraryHookPoints(db: DbHooks, point: ExtensionHookContributionPoint): void {
  db.libraryChanged.tap((p) => point.notify('library.changed', p))
  db.entityMerging.tap(async (p) => (await point.veto('library.entity-merging', p)) ?? undefined)
  db.entityMerged.tap((p) => point.notify('library.entity-merged', p))
}
