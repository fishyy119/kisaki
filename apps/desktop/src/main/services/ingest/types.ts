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
