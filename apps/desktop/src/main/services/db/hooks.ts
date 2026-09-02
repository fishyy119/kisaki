/**
 * Db module hook points.
 *
 * Owned by DbService: the change feed dispatches `dbChanged`, `libraryChanged`
 * and `settingsChanged` after commits, the entity merge coordinator dispatches
 * `entityMerging` (before its transaction) and `entityMerged` (after).
 */

import { createNotifyHook, createVetoHook, type NotifyHook, type VetoHook } from '@main/hooks'
import type { AllEntityType } from '@shared/entity-types'
import type { DbChangeSummary } from '@shared/db/changes'
import type { LibraryChangedPayload, LibraryEntityMergedEvent } from '@shared/library'

export interface LibraryEntityMergingPayload {
  entityType: AllEntityType
  targetId: string
  sourceId: string
}

export interface AppSettingChangedPayload {
  setting: string
  value: unknown
}

export interface DbChangedPayload {
  changes: DbChangeSummary[]
}

export interface DbHooks {
  /**
   * Row-level change summaries (post-commit), the main-process counterpart of
   * the `db:changed` push. Configuration rows are written by the renderer, so
   * main-process modules that must react to them subscribe here.
   */
  dbChanged: NotifyHook<DbChangedPayload>
  /** Debounced, entity-grouped library change feed (post-commit). */
  libraryChanged: NotifyHook<LibraryChangedPayload>
  /** Gatekeeps an entity merge; a veto aborts before the merge transaction. */
  entityMerging: VetoHook<LibraryEntityMergingPayload>
  entityMerged: NotifyHook<LibraryEntityMergedEvent>
  settingsChanged: NotifyHook<AppSettingChangedPayload>
}

export function createDbHooks(): DbHooks {
  return {
    dbChanged: createNotifyHook<DbChangedPayload>('db.changed'),
    libraryChanged: createNotifyHook<LibraryChangedPayload>('library.changed'),
    entityMerging: createVetoHook<LibraryEntityMergingPayload>('library.entity-merging'),
    entityMerged: createNotifyHook<LibraryEntityMergedEvent>('library.entity-merged'),
    settingsChanged: createNotifyHook<AppSettingChangedPayload>('app.settings.changed')
  }
}
