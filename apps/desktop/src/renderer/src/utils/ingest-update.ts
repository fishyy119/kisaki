export { buildIngestUpdateLookup } from '@shared/ingest/update'

export interface BatchProgressState {
  total: number
  processed: number
  successCount: number
  failureCount: number
  currentItem: string
}
