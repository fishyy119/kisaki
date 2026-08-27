/**
 * Run vocabulary shared by the run engine and the scan pipeline that feeds it.
 *
 * The pipeline reports one `ScannerEntityProcessResult` per discovered
 * directory; the run state store turns those into the issue and existing
 * lists the renderer shows.
 */

import type { TaskRunHandle } from '@main/services/task-run'
import type { Scanner } from '@shared/db'
import type { ScannerRunExisting, ScannerRunState } from '@shared/scanner'

export type ScannerEntityWarningType =
  | 'asset-persist-failed'
  | 'collection-replace-degraded'
  | 'file-sync-failed'
  | 'metadata-missing'
  | 'related-entry-not-in-library'
  | 'scraper-unavailable'

export type ScannerEntityErrorType =
  | 'duplicate-external-id'
  | 'metadata-missing'
  | 'path-unavailable'
  | 'scraper-unavailable'
  | 'unexpected-error'
  | 'unsupported-entry'

export interface ScannedEntity {
  extractedName: string
  path: string
}

export interface ScannerEntityWarning {
  type: ScannerEntityWarningType
  reason: string
}

export interface ScannerEntityError {
  type: ScannerEntityErrorType
  reason: string
}

export type ScannerEntityProcessResult =
  | (ScannedEntity & {
      kind: 'new'
      entityId: string
      warnings?: ScannerEntityWarning[]
    })
  | { kind: 'existing'; existing: ScannerRunExisting }
  | (ScannedEntity & {
      kind: 'failed'
      existingEntityId?: string
      errors: ScannerEntityError[]
    })

export interface ActiveScannerRun {
  scanner: Scanner
  taskRun: TaskRunHandle
  state: ScannerRunState
}
