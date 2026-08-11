import type { TaskRunHandle } from '@main/services/task-run'
import type { ScannerRunIssue, ScannerRunState } from '@shared/scanner'
import type {
  ScannedEntity,
  ScannerEntityError,
  ScannerEntityProcessResult,
  ScannerEntityWarning,
  ScannerRunMetadata
} from './types'

type NewScannerEntityProcessResult = Extract<ScannerEntityProcessResult, { kind: 'new' }>
type FailedScannerEntityProcessResult = Extract<ScannerEntityProcessResult, { kind: 'failed' }>

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
      existingCount: 0,
      failedCount: 0,
      issueCount: 0,
      issues: [],
      existing: [],
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
      case 'new':
        next = this.recordIssues(
          { ...next, newCount: next.newCount + 1 },
          result.warnings?.map((warning, index) => toNewIssue(warning, result, index))
        )
        break
      case 'existing':
        next = {
          ...next,
          existingCount: next.existingCount + 1,
          existing: [...next.existing, result.existing]
        }
        break
      case 'failed':
        next = this.recordIssues(
          { ...next, failedCount: next.failedCount + 1 },
          result.errors.map((error, index) => toFailedIssue(error, result, index))
        )
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

  private recordIssues(
    state: ScannerRunState,
    issues: readonly ScannerRunIssue[] | undefined
  ): ScannerRunState {
    if (!issues?.length) {
      return state
    }

    return {
      ...state,
      issueCount: state.issueCount + issues.length,
      issues: [...state.issues, ...issues]
    }
  }
}

function toIssueBase(
  problem: ScannerEntityWarning | ScannerEntityError,
  entity: ScannedEntity,
  index: number,
  targetId = ''
) {
  return {
    id: `${problem.type}:${entity.path}:${targetId}:${index}`,
    type: problem.type,
    extractedName: entity.extractedName,
    path: entity.path,
    reason: problem.reason,
    fixable: isIssueFixable(problem.type)
  }
}

function toNewIssue(
  warning: ScannerEntityWarning,
  result: NewScannerEntityProcessResult,
  index: number
): ScannerRunIssue {
  return { ...toIssueBase(warning, result, index, result.entityId), entityId: result.entityId }
}

function toFailedIssue(
  error: ScannerEntityError,
  result: FailedScannerEntityProcessResult,
  index: number
): ScannerRunIssue {
  const issue = toIssueBase(error, result, index, result.existingEntityId)
  if (result.existingEntityId) {
    return { ...issue, existingEntityId: result.existingEntityId }
  }

  return issue
}

function isIssueFixable(type: ScannerRunIssue['type']): boolean {
  switch (type) {
    case 'asset-persist-failed':
    case 'file-sync-failed':
    case 'path-unavailable':
    case 'unsupported-entry':
      return false
    default:
      return true
  }
}

export function cloneScannerRunState(state: ScannerRunState): ScannerRunState {
  return {
    ...state,
    issues: state.issues.map((issue) => ({ ...issue })),
    existing: state.existing.map((existing) => ({ ...existing }))
  }
}
