import type { MediaType } from '@shared/entity-types'
import type { ScannerRunIssue, ScannerRunIssueType } from '@shared/scanner'
import { assertNever } from '@shared/utils/exhaustive'
import { messages } from '@renderer/core/i18n'

export interface ScannerIssueRow {
  scannerId: string
  scannerName: string
  mediaType: MediaType
  issue: ScannerRunIssue
  existingEntityName?: string
}

/** An issue carried into the fix dialog, with the run context it needs there. */
export type ScannerFixTarget = ScannerRunIssue & {
  mediaType: MediaType
  scannerId?: string
  scannerName?: string
}

export function getIssueTypeText(type: ScannerRunIssueType): string {
  const issueTypes = messages.value.scanner.issueTypes
  switch (type) {
    case 'asset-persist-failed':
      return issueTypes.assetPersistFailed
    case 'collection-replace-degraded':
      return issueTypes.collectionReplaceDegraded
    case 'duplicate-external-id':
      return issueTypes.duplicateExternalId
    case 'file-sync-failed':
      return issueTypes.fileSyncFailed
    case 'metadata-missing':
      return issueTypes.metadataMissing
    case 'path-unavailable':
      return issueTypes.pathUnavailable
    case 'related-entry-not-in-library':
      return issueTypes.relatedEntryNotInLibrary
    case 'scraper-unavailable':
      return issueTypes.scraperUnavailable
    case 'unexpected-error':
      return issueTypes.unexpectedError
    case 'unsupported-entry':
      return issueTypes.unsupportedEntry
    default:
      return assertNever(type, 'scanner issue type')
  }
}

export function toIssueFixTarget(row: ScannerIssueRow): ScannerFixTarget {
  return {
    ...row.issue,
    mediaType: row.mediaType,
    scannerId: row.scannerId,
    scannerName: row.scannerName
  }
}
