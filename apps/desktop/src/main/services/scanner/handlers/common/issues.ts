/**
 * Scanner issue construction and failure classification.
 *
 * Media-neutral: every media handler reports the same issue vocabulary so the
 * renderer can render one issues table regardless of what was scanned.
 */

import type { IngestWarning } from '@shared/ingest/common'
import type { EntityEntry, ScannerRunExisting } from '@shared/scanner'
import type {
  ScannedEntity,
  ScannerEntityError,
  ScannerEntityErrorType,
  ScannerEntityWarning,
  ScannerEntityWarningType
} from './types'

/**
 * Failures worth reporting as an issue instead of aborting the whole run.
 *
 * Anything else is a defect in our own code and must surface as a run failure.
 */
const RECOVERABLE_SCRAPER_MARKERS = [
  'profile not found',
  'search provider',
  'provider',
  'scrape',
  'network',
  'timeout',
  'timed out',
  'econn',
  'enotfound',
  'eai_again'
]

/** Matches the "no data for this lookup" error raised by every add handler. */
const MISSING_METADATA_PATTERN = /returned no \S+ data/

export function isRecoverableScraperFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return RECOVERABLE_SCRAPER_MARKERS.some((marker) => message.includes(marker))
}

export function isMissingMetadataScraperFailure(error: unknown): boolean {
  return error instanceof Error && MISSING_METADATA_PATTERN.test(error.message.toLowerCase())
}

export function getScraperProblemType(
  error: unknown
): Extract<ScannerEntityWarningType, ScannerEntityErrorType> {
  return isMissingMetadataScraperFailure(error) ? 'metadata-missing' : 'scraper-unavailable'
}

export function createScannedEntity(entity: EntityEntry): ScannedEntity {
  return {
    extractedName: entity.extractedName,
    path: entity.path
  }
}

export function createWarning(
  type: ScannerEntityWarningType,
  reason: string
): ScannerEntityWarning {
  return { type, reason }
}

export function createError(type: ScannerEntityErrorType, reason: string): ScannerEntityError {
  return { type, reason }
}

export function createIngestWarnings(
  warnings: readonly IngestWarning[] | undefined
): ScannerEntityWarning[] {
  return (warnings ?? []).map((warning) =>
    createWarning('asset-persist-failed', warning.message)
  )
}

export function createExisting(entity: EntityEntry, entityId: string): ScannerRunExisting {
  return {
    id: `existing:${entity.path}:${entityId}`,
    extractedName: entity.extractedName,
    path: entity.path,
    entityId
  }
}
