import { TaskRunCancellation } from '@main/services/task-run'
import type { TaskRunInitiator, TaskRunProgressUpdate, TaskRunProgressWork } from '@shared/task-run'

export type IngestProgressPhase =
  'checking' | 'preparing' | 'scraping' | 'building' | 'planning' | 'writing' | 'assets'

export interface IngestProgressUpdate {
  phase: IngestProgressPhase
  label: string
  phaseCurrent?: number
  phaseTotal?: number
  work?: TaskRunProgressWork
}

export interface IngestOperationOptions {
  signal?: AbortSignal
  onProgress?: (update: TaskRunProgressUpdate) => void
}

export interface IngestTaskRunOptions {
  taskRunInitiator?: TaskRunInitiator
}

export function reportIngestProgress(
  options: IngestOperationOptions | undefined,
  update: IngestProgressUpdate
): void {
  const defaultPosition = getDefaultIngestPhasePosition(update.phase)
  const phase: TaskRunProgressUpdate['phase'] = {
    key: update.phase,
    label: update.label
  }
  const current = update.phaseCurrent ?? defaultPosition?.current
  const total = update.phaseTotal ?? defaultPosition?.total
  if (current !== undefined) {
    phase.current = current
  }
  if (total !== undefined) {
    phase.total = total
  }

  options?.onProgress?.({
    phase,
    work: update.work
  })
}

function getDefaultIngestPhasePosition(
  phase: IngestProgressPhase
): { current: number; total: number } | undefined {
  switch (phase) {
    case 'checking':
    case 'preparing':
      return { current: 1, total: 4 }
    case 'scraping':
      return { current: 2, total: 4 }
    case 'building':
    case 'planning':
      return { current: 3, total: 4 }
    case 'writing':
      return { current: 4, total: 4 }
    case 'assets':
      return undefined
  }
}

export function throwIfIngestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TaskRunCancellation()
  }
}
