import type { TaskRunHandle } from '@main/services/task-run'
import type { MediaType } from '@shared/common'
import type { FailedScan, ScannerRunState, SkippedScan } from '@shared/scanner'

export interface ScannerRunMetadata {
  id: string
  name: string
  type: MediaType
  path: string
}

export type ScannerEntityProcessResult =
  | { kind: 'processed-only' }
  | { kind: 'new' }
  | { kind: 'skipped'; skippedScan: SkippedScan }
  | { kind: 'failed'; failedScan: FailedScan }

export interface ActiveScannerRun<TScanner extends ScannerRunMetadata> {
  scanner: TScanner
  taskRun: TaskRunHandle
  state: ScannerRunState
}
