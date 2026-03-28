import type { MediaType } from '@shared/common'
import type { FailedScan, ScanCompletedData, SkippedScan } from '@shared/scanner'

export interface ScannerRunMetadata {
  id: string
  name: string
  type: MediaType
  path: string
}

export interface ScanController {
  scannerId: string
  pauseRequested: boolean
  abortRequested: boolean
  resumeWaiters: Set<() => void>
}

export interface ScanQueueItem<TScanner extends ScannerRunMetadata> {
  scannerId: string
  scanner: TScanner
  controller: ScanController
  resolve: (value: ScanCompletedData) => void
  reject: (reason: unknown) => void
}

export type ScannerEntityProcessResult =
  | { kind: 'processed-only' }
  | { kind: 'new' }
  | { kind: 'skipped'; skippedScan: SkippedScan }
  | { kind: 'failed'; failedScan: FailedScan }
