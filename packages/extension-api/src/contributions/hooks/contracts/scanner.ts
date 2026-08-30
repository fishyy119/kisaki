import type { LibraryMediaType } from '../../../capabilities/library'
import type { ExternalId } from '../../../shared'
import type { HookPointSpec } from './point'

/** One filesystem entry discovered by a scanner run. */
export interface ScannerEntry {
  /** Full path to the entity directory. */
  path: string
  /** Original filesystem directory name. */
  originalName: string
  /** Extracted entity name after applying name extraction rules. */
  extractedName: string
  /** Rule id that matched during extraction (null if none). */
  matchedRuleId: string | null
}

export interface ScannerDiscoveredEntry {
  /** Media type of the scan run that produced the entry. */
  mediaType: LibraryMediaType
  entry: ScannerEntry
  /** When set to true the entry is dropped from the scan run. */
  skip: boolean
}

export interface ScannerMatchedEntry {
  /** Media type of the scan run that produced the entry. */
  mediaType: LibraryMediaType
  entry: ScannerEntry
  name: string
  externalIds: ExternalId[]
  matchSource: string
}

export interface ScannerRunStartedPayload {
  scannerId: string
  scannerName: string
}

export type ScannerRunFinishedStatus = 'completed' | 'failed' | 'cancelled'

export interface ScannerRunFinishedPayload {
  scannerId: string
  scannerName: string
  status: ScannerRunFinishedStatus
  stats: Record<string, number>
  error?: string | undefined
}

/**
 * Scanner hook points.
 *
 * Entry points are waterfall transforms inside the scan pipeline before any
 * ingest write; run points are after-the-fact notifications.
 */
export interface ScannerHookPoints {
  'scanner.entry.discovered': HookPointSpec<'waterfall', ScannerDiscoveredEntry>
  'scanner.entry.matched': HookPointSpec<'waterfall', ScannerMatchedEntry>
  'scanner.run.started': HookPointSpec<'notify', ScannerRunStartedPayload>
  'scanner.run.finished': HookPointSpec<'notify', ScannerRunFinishedPayload>
}
