/**
 * Run vocabulary shared by the run engine and the media handlers that feed it.
 *
 * A handler reports one `ScannerEntityProcessResult` per discovered directory;
 * the run state store turns those into the issue and existing lists the
 * renderer shows.
 */

import type { TaskRunHandle } from '@main/services/task-run'
import type { MediaType } from '@shared/common'
import type { ScannerRunExisting, ScannerRunState } from '@shared/scanner'

export interface ScannerRunMetadata {
  id: string
  name: string
  type: MediaType
  path: string
}

export type ScannerEntityWarningType =
  'asset-persist-failed' | 'file-sync-failed' | 'metadata-missing' | 'scraper-unavailable'

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

export interface ActiveScannerRun<TScanner extends ScannerRunMetadata> {
  scanner: TScanner
  taskRun: TaskRunHandle
  state: ScannerRunState
}
