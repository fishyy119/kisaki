import { TaskRunCancellation } from '@main/services/task-run'
import type { TaskRunInitiator } from '@shared/task-run'

export type IngestProgressPhase =
  | 'checking'
  | 'preparing'
  | 'scraping'
  | 'building'
  | 'planning'
  | 'writing'
  | 'assets'

export interface IngestProgressUpdate {
  phase: IngestProgressPhase
  message?: string
  indeterminate?: boolean
}

export interface IngestOperationOptions {
  signal?: AbortSignal
  onProgress?: (update: IngestProgressUpdate) => void
}

export interface IngestTaskRunOptions {
  taskRunInitiator?: TaskRunInitiator
}

export function reportIngestProgress(
  options: IngestOperationOptions | undefined,
  update: IngestProgressUpdate
): void {
  options?.onProgress?.({
    indeterminate: true,
    ...update
  })
}

export function throwIfIngestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TaskRunCancellation()
  }
}
