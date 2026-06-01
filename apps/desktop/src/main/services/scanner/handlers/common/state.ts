import type { TaskRunHandle } from '@main/services/task-run'
import type { ScannerRunState } from '@shared/scanner'
import type { ScannerEntityProcessResult, ScannerRunMetadata } from './types'

export class ScannerRunStateStore<TScanner extends ScannerRunMetadata> {
  private readonly states = new Map<string, ScannerRunState>()

  list(): ScannerRunState[] {
    return [...this.states.values()]
      .map(cloneScannerRunState)
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }

  create(scanner: TScanner, run: TaskRunHandle): ScannerRunState {
    const state: ScannerRunState = {
      runId: run.id,
      scannerId: scanner.id,
      scannerName: scanner.name,
      mediaType: scanner.type,
      path: scanner.path,
      status: 'queued',
      total: 0,
      processedCount: 0,
      newCount: 0,
      skippedCount: 0,
      failedCount: 0,
      skippedScans: [],
      failedScans: [],
      createdAt: run.createdAt,
      updatedAt: run.createdAt
    }

    this.states.set(scanner.id, state)
    return state
  }

  patch(scannerId: string, patch: Partial<ScannerRunState>): ScannerRunState {
    const current = this.require(scannerId)
    const next = {
      ...current,
      ...patch,
      updatedAt: Date.now()
    }
    this.states.set(scannerId, next)
    return next
  }

  recordEntityResult(scannerId: string, result: ScannerEntityProcessResult): ScannerRunState {
    const current = this.require(scannerId)
    let next: ScannerRunState = {
      ...current,
      processedCount: current.processedCount + 1,
      updatedAt: Date.now()
    }

    switch (result.kind) {
      case 'processed-only':
        break
      case 'new':
        next = { ...next, newCount: next.newCount + 1 }
        break
      case 'skipped':
        next = {
          ...next,
          skippedCount: next.skippedCount + 1,
          skippedScans: [...next.skippedScans, result.skippedScan]
        }
        break
      case 'failed':
        next = {
          ...next,
          failedCount: next.failedCount + 1,
          failedScans: [...next.failedScans, result.failedScan]
        }
        break
      default:
        throw new Error(`Unknown scanner entity result kind: ${(result as { kind: string }).kind}`)
    }

    this.states.set(scannerId, next)
    return next
  }

  private require(scannerId: string): ScannerRunState {
    const state = this.states.get(scannerId)
    if (!state) {
      throw new Error(`Scanner run state ${scannerId} does not exist.`)
    }
    return state
  }
}

export function cloneScannerRunState(state: ScannerRunState): ScannerRunState {
  return {
    ...state,
    skippedScans: [...state.skippedScans],
    failedScans: [...state.failedScans]
  }
}
