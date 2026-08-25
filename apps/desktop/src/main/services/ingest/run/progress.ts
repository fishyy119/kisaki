/**
 * Ingest progress reporting.
 *
 * Ingest phases advance in a fixed order, so each phase carries a default
 * position that handlers do not have to restate. Handlers may override it when
 * they know a finer-grained count (batch item N of M, for instance).
 */

import type { TaskRunProgressUpdate } from '@shared/task-run'
import type { IngestOperationOptions, IngestProgressPhase, IngestProgressUpdate } from '../types'

export function reportIngestProgress(
  options: IngestOperationOptions | undefined,
  update: IngestProgressUpdate
): void {
  const defaultPosition = getDefaultIngestPhasePosition(update.phase)
  const phase: TaskRunProgressUpdate['phase'] = {
    key: update.phase,
    label: update.label
  }
  const current = update.phaseCurrent ?? defaultPosition?.current
  const total = update.phaseTotal ?? defaultPosition?.total
  if (current !== undefined) {
    phase.current = current
  }
  if (total !== undefined) {
    phase.total = total
  }

  options?.onProgress?.({
    phase,
    work: update.work
  })
}

function getDefaultIngestPhasePosition(
  phase: IngestProgressPhase
): { current: number; total: number } | undefined {
  switch (phase) {
    case 'checking':
    case 'preparing':
      return { current: 1, total: 4 }
    case 'scraping':
      return { current: 2, total: 4 }
    case 'building':
    case 'planning':
      return { current: 3, total: 4 }
    case 'writing':
      return { current: 4, total: 4 }
    case 'assets':
      return undefined
  }
}
