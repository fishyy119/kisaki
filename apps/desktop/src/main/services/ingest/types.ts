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
  signal?: AbortSignal | undefined
  onProgress?: ((update: TaskRunProgressUpdate) => void) | undefined
}

export interface IngestTaskRunOptions {
  taskRunInitiator?: TaskRunInitiator | undefined
}
