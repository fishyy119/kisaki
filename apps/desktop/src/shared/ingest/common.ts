/**
 * Shared ingest contracts.
 *
 * Ingest exposes stable cross-process contracts for add/update flows.
 */

/** Reason why an entity was not newly added. */
export type ExistingReason = 'externalId' | 'path'

/** Stable warning code emitted by ingest post-commit work. */
export type IngestWarningCode = 'asset-persist-failed'

/** Warning emitted after the main DB transaction succeeds. */
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
