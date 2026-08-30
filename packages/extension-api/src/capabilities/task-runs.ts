import { CANCELLED_ERROR_CODE } from '../shared'
import type { JsonValue } from '../shared'

export type TaskRunOperation = string

export type TaskRunStatus =
  'queued' | 'running' | 'pausing' | 'paused' | 'cancelling' | 'completed' | 'failed' | 'cancelled'

export type TaskRunFinalStatus = Extract<TaskRunStatus, 'completed' | 'failed' | 'cancelled'>

export type TaskRunAutomationTrigger = 'manual' | 'startup' | 'cron'

export type TaskRunSystemReason = 'startup' | 'maintenance' | 'update' | 'shutdown' | 'watch'

export type TaskRunInitiator =
  | {
      type: 'user'
    }
  | {
      type: 'automation'
      automation: {
        id: string
        nameSnapshot: string
        trigger: TaskRunAutomationTrigger
        attempt: number
      }
    }
  | {
      type: 'extension'
      extension: {
        id: string
        nameSnapshot?: string | undefined
      }
    }
  | {
      type: 'system'
      reason?: TaskRunSystemReason | undefined
    }

export type TaskRunProgressUnit =
  'item' | 'file' | 'byte' | 'entity' | 'step' | 'package' | 'request'

export type TaskRunRatePeriod = 'second' | 'minute' | 'hour'

export interface TaskRunWarning {
  code?: string | undefined
  message: string
}

export interface TaskRunProgressPhase {
  key: string
  label: string
  current?: number | undefined
  total?: number | undefined
}

export interface TaskRunProgressWork {
  current?: number | undefined
  total?: number | undefined
  unit?: TaskRunProgressUnit | undefined
  ratePeriod?: TaskRunRatePeriod | undefined
  indeterminate?: boolean | undefined
}

export interface TaskRunProgressWorkMetrics {
  rate?: number | undefined
  etaMs?: number | undefined
  percent?: number | undefined
}

export interface TaskRunProgressUpdate {
  phase?: TaskRunProgressPhase | undefined
  work?: TaskRunProgressWork | undefined
  counters?: Record<string, number> | undefined
  warnings?: readonly TaskRunWarning[] | undefined
}

export interface TaskRunProgress extends Omit<TaskRunProgressUpdate, 'work'> {
  work?: (TaskRunProgressWork & TaskRunProgressWorkMetrics) | undefined
  updatedAt: number
}

export interface TaskRunResult {
  status: TaskRunFinalStatus
  title?: string | undefined
  summary?: string | undefined
  output?: JsonValue | undefined
  error?: string | undefined
  counters?: Record<string, number> | undefined
  warnings?: readonly TaskRunWarning[] | undefined
}

export type TaskRunSubjectType = 'command' | 'extension'

export interface TaskRunSubject {
  type: TaskRunSubjectType
  id?: string | undefined
  labelSnapshot?: string | undefined
}

export interface TaskRunControls {
  cancelable?: boolean | undefined
  pausable?: boolean | undefined
}

export interface TaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string | undefined
    message?: string | undefined
    showProgress?: boolean | undefined
    showResult?: boolean | undefined
    closable?: boolean | undefined
  }
}

export interface TaskRunSnapshot {
  id: string
  operation: TaskRunOperation
  title: string
  description?: string | undefined
  status: TaskRunStatus
  initiator: TaskRunInitiator
  subject?: TaskRunSubject | undefined
  controls: Required<TaskRunControls>
  progress?: TaskRunProgress | undefined
  result?: TaskRunResult | undefined
  createdAt: number
  startedAt?: number | undefined
  updatedAt: number
  finishedAt?: number | undefined
}

export interface TaskRunCreateInput {
  operation: TaskRunOperation
  title: string
  description?: string | undefined
  initiator?: TaskRunInitiator | undefined
  subject?: TaskRunSubject | undefined
  controls?: TaskRunControls | undefined
  presentation?: TaskRunPresentation | undefined
}

export interface TaskRunActiveListQuery {
  operations?: readonly TaskRunOperation[] | undefined
  subject?: {
    type: TaskRunSubjectType
    id?: string | undefined
  }
  limit?: number | undefined
}

export interface TaskRunHistoryListQuery {
  statuses?: readonly TaskRunFinalStatus[] | undefined
  operations?: readonly TaskRunOperation[] | undefined
  subject?: {
    type: TaskRunSubjectType
    id?: string | undefined
  }
  limit?: number | undefined
}

export class TaskRunCancellation extends Error {
  override readonly name = 'TaskRunCancellation'
  /** Carries the shared code so `isCancellationError` recognizes this too. */
  readonly code = CANCELLED_ERROR_CODE

  constructor(message = 'Extension task run was cancelled.') {
    super(message)
  }
}

export function isTaskRunCancellation(error: unknown): error is TaskRunCancellation {
  return error instanceof TaskRunCancellation
}

export interface TaskRunHandle {
  readonly id: string
  readonly signal: AbortSignal
  report(update: TaskRunProgressUpdate): Promise<void>
  checkpoint(): Promise<void>
  complete(result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
  fail(error: unknown, result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
  cancel(result?: Omit<TaskRunResult, 'status' | 'error'>): Promise<void>
}

export interface TaskRunsCapability {
  create(input: TaskRunCreateInput): Promise<TaskRunHandle>
  listActiveOwn(query?: TaskRunActiveListQuery): Promise<readonly TaskRunSnapshot[]>
  listHistoryOwn(query?: TaskRunHistoryListQuery): Promise<readonly TaskRunSnapshot[]>
  getActiveOwn(runId: string): Promise<TaskRunSnapshot | null>
  getHistoryOwn(runId: string): Promise<TaskRunSnapshot | null>
  cancelOwn(runId: string): Promise<boolean>
  waitOwn(runId: string): Promise<TaskRunSnapshot>
}
