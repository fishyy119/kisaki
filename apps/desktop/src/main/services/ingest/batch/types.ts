import type { ExternalId } from '@shared/identity'

export type IngestBatchPhase = 'searching' | 'updating'

export interface IngestBatchUpdateRow {
  id: string
  name: string
  originalName: string | null
  externalIds: ExternalId[]
}

export interface IngestBatchFailure {
  entityId?: string
  name?: string
  error: string
}

export interface IngestBatchItemWarning {
  entityId?: string
  name?: string
  code?: string
  message: string
}

export interface IngestBatchResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  failures: IngestBatchFailure[]
  warnings: IngestBatchItemWarning[]
}

export interface IngestBatchCounters {
  [key: string]: number
  succeeded: number
  failed: number
  skipped: number
  warnings: number
}
