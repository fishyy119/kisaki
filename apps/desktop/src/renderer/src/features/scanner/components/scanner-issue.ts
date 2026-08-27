import type { MediaType } from '@shared/common'
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

export function getIssueIcon(type: ScannerRunIssueType): string {
  switch (type) {
    case 'asset-persist-failed':
      return 'icon-[mdi--image-broken-variant]'
    case 'collection-replace-degraded':
      return 'icon-[mdi--link-off]'
    case 'metadata-missing':
      return 'icon-[mdi--database-off-outline]'
    case 'file-sync-failed':
      return 'icon-[mdi--sync-alert]'
    case 'duplicate-external-id':
      return 'icon-[mdi--link-variant]'
    case 'path-unavailable':
      return 'icon-[mdi--folder-alert-outline]'
    case 'related-entry-not-in-library':
      return 'icon-[mdi--book-remove-outline]'
    case 'scraper-unavailable':
      return 'icon-[mdi--cloud-off-outline]'
    case 'unexpected-error':
      return 'icon-[mdi--alert-circle-outline]'
    case 'unsupported-entry':
      return 'icon-[mdi--file-question-outline]'
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
