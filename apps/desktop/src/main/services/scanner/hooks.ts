/**
 * Scanner module hook points.
 *
 * Owned by ScannerService. Entry hooks run inside the scan pipeline before any
 * ingest write; run hooks are after-the-fact notifications.
 */

import {
  createNotifyHook,
  createWaterfallHook,
  type NotifyHook,
  type WaterfallHook
} from '@main/hooks'
import type { ExternalId } from '@shared/identity'
import type { EntityEntry, ScannerRunFinishedStatus } from '@shared/scanner'

export interface ScannerDiscoveredEntry {
  entry: EntityEntry
  /** When set to true the entry is dropped from the scan run. */
  skip: boolean
}

export interface ScannerMatchedEntry {
  entry: EntityEntry
  name: string
  externalIds: ExternalId[]
  matchSource: string
}

export interface ScannerRunStartedPayload {
  scannerId: string
  scannerName: string
}

export interface ScannerRunFinishedPayload {
  scannerId: string
  scannerName: string
  status: ScannerRunFinishedStatus
  stats: Record<string, number>
  error?: string
}

export interface ScannerHooks {
  /** Transforms or skips a discovered entry before it enters processing. */
  entryDiscovered: WaterfallHook<ScannerDiscoveredEntry>
  /** Transforms the match result before it drives the ingest decision. */
  entryMatched: WaterfallHook<ScannerMatchedEntry>
  runStarted: NotifyHook<ScannerRunStartedPayload>
  runFinished: NotifyHook<ScannerRunFinishedPayload>
}

export function createScannerHooks(): ScannerHooks {
  return {
    entryDiscovered: createWaterfallHook<ScannerDiscoveredEntry>('scanner.entry.discovered'),
    entryMatched: createWaterfallHook<ScannerMatchedEntry>('scanner.entry.matched'),
    runStarted: createNotifyHook<ScannerRunStartedPayload>('scanner.run.started'),
    runFinished: createNotifyHook<ScannerRunFinishedPayload>('scanner.run.finished')
  }
}
