/**
 * Ingest cancellation checkpoints.
 *
 * Only valid before the database commit point; after commit the operation owns
 * its completion and reports late failures as warnings instead.
 */

import { TaskRunCancellation } from '@main/services/task-run'

export function throwIfIngestAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TaskRunCancellation()
  }
}
