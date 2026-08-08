/**
 * Ingest cancellation checkpoints.
 *
 * Only valid before the database commit point; after commit the operation owns
 * its completion and reports late failures as warnings instead.
 */

import { isAbortError } from '@main/utils/async'
import { isTaskRunCancellation, TaskRunCancellation } from '@main/services/task-run'

export function throwIfIngestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TaskRunCancellation()
  }
}

/**
 * Cancellation raised anywhere below an ingest operation.
 *
 * Ingest checkpoints throw `TaskRunCancellation`, while layers that abort real
 * work — scraper providers, network requests, streams — raise an `AbortError`.
 * Both mean the caller asked to stop, so neither is reported as a failure.
 */
export function isIngestCancellation(error: unknown): boolean {
  return isTaskRunCancellation(error) || isAbortError(error)
}
