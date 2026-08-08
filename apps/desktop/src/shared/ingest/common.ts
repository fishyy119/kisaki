/**
 * Shared ingest contracts.
 *
 * Ingest exposes stable cross-process contracts for add/update flows.
 */

/** Reason why an entity was not newly added. */
export type ExistingReason = 'externalId' | 'path'

/**
 * Stable warning code emitted by an ingest run.
 *
 * - `asset-persist-failed`: a deferred asset download failed past the commit point.
 * - `collection-replace-degraded`: the replace policy fell back to merge because
 *   the scraper did not answer every fact source feeding that collection.
 */
export type IngestWarningCode = 'asset-persist-failed' | 'collection-replace-degraded'

/** Warning reported with a successful ingest result. */
export interface IngestWarning {
  code: IngestWarningCode
  message: string
}

/**
 * Base result for ingest add flows.
 */
export interface IngestAddResult {
  isNew: boolean
  existingReason?: ExistingReason
  warnings?: IngestWarning[]
}

/**
 * Result for metadata update flows.
 */
export interface IngestUpdateResult {
  warnings?: IngestWarning[]
}
