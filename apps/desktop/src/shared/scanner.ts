/**
 * Scanner run and result types
 */

import type { MediaType } from './common'

/**
 * Represents a detected entity from directory scanning.
 * Used by all media types - the scanning layer is media-agnostic.
 */
export interface EntityEntry {
  /** Full path to the entity directory */
  path: string
  /** Original filesystem directory name */
  originalName: string
  /** Original name used as extraction input */
  originalBaseName: string
  /** Extracted entity name after applying name extraction rules */
  extractedName: string
  /** Rule id that matched during extraction (null if none) */
  matchedRuleId: string | null
}

export type ScannerRunIssueType =
  | 'asset-persist-failed'
  | 'duplicate-external-id'
  | 'metadata-missing'
  | 'path-unavailable'
  | 'scraper-unavailable'
  | 'unexpected-error'
  | 'unsupported-entry'

/**
 * User-visible scan result issue.
 * Entity processing may produce warnings for successful additions or errors for
 * failed entities. Run state exposes both as this unified issue shape.
 */
interface ScannerRunIssueBase {
  id: string
  type: ScannerRunIssueType
  extractedName: string
  path: string
  reason: string
  fixable: boolean
}

type ScannerRunIssueGameRef =
  | { gameId: string; existingGameId?: never }
  | { gameId?: never; existingGameId: string }
  | { gameId?: never; existingGameId?: never }

export type ScannerRunIssue = ScannerRunIssueBase & ScannerRunIssueGameRef

/**
 * Entity already represented by an existing library entry.
 * Existing entries are scanner bookkeeping, not issues.
 */
export interface ScannerRunExisting {
  id: string
  extractedName: string
  path: string
  gameId: string
}

export type ScannerRunStatus =
  'queued' | 'running' | 'pausing' | 'paused' | 'cancelling' | 'completed' | 'failed' | 'cancelled'

export const ACTIVE_SCANNER_RUN_STATUSES = [
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling'
] as const satisfies readonly ScannerRunStatus[]

export type ActiveScannerRunStatus = (typeof ACTIVE_SCANNER_RUN_STATUSES)[number]

export function isActiveScannerRunStatus(
  status: ScannerRunStatus
): status is ActiveScannerRunStatus {
  return (ACTIVE_SCANNER_RUN_STATUSES as readonly ScannerRunStatus[]).includes(status)
}

/**
 * Scanner-owned mutable run state for the current app lifecycle.
 */
export interface ScannerRunState {
  runId: string
  scannerId: string
  scannerName: string
  mediaType: MediaType
  path: string
  status: ScannerRunStatus
  phase?: string
  message?: string
  total: number
  processedCount: number
  newCount: number
  existingCount: number
  failedCount: number
  issueCount: number
  issues: ScannerRunIssue[]
  existing: ScannerRunExisting[]
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}

export interface ScannerRunStartResult {
  runId: string
  createdAt: number
}

/**
 * Final scan result returned when scan completes.
 */
export interface ScanCompletedData {
  scannerId: string
  scannerName: string
  mediaType: MediaType
  path: string
  status: 'completed' | 'failed' | 'cancelled'
  total: number
  processedCount: number
  newCount: number
  existingCount: number
  failedCount: number
  issueCount: number
  issues: ScannerRunIssue[]
  existing: ScannerRunExisting[]
}

// =============================================================================
// Name Extraction Types
// =============================================================================

/** Extraction test result */
export interface ExtractionTestResult {
  originalName: string
  extractedName: string
  matchedRuleId: string | null
}
