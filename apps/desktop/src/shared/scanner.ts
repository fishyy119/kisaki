/**
 * Scanner run and result types
 */

import type { MediaType } from './common'
import type { FailedScan } from './db'

export type { FailedScan }

/**
 * Represents a detected entity from directory scanning.
 * Used by all media types - the scanning layer is media-agnostic.
 */
export interface EntityEntry {
  /** Full path to the entity (file or folder) */
  path: string
  /** Original filesystem name (folder name or filename with extension, if any) */
  originalName: string
  /** Original name without extension (used as extraction input) */
  originalBaseName: string
  /** Extracted entity name after applying name extraction rules */
  extractedName: string
  /** Rule id that matched during extraction (null if none) */
  matchedRuleId: string | null
}

/** A scan that was skipped because the game already exists */
export interface SkippedScan {
  name: string
  path: string
  reason: 'path' | 'externalId'
  existingGameId: string
}

export type ScannerRunStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

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
  skippedCount: number
  failedCount: number
  skippedScans: SkippedScan[]
  failedScans: FailedScan[]
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
  skippedCount: number
  failedCount: number
  skippedScans: SkippedScan[]
  failedScans: FailedScan[]
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
