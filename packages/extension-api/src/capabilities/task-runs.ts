import type { JsonValue } from '../shared'

export type TaskRunOperation = string

export type TaskRunStatus =
  'queued' | 'running' | 'pausing' | 'paused' | 'cancelling' | 'completed' | 'failed' | 'cancelled'

export type TaskRunFinalStatus = Extract<TaskRunStatus, 'completed' | 'failed' | 'cancelled'>

export type TaskRunAutomationTrigger = 'manual' | 'startup' | 'cron'

export type TaskRunSystemReason = 'startup' | 'maintenance' | 'update' | 'shutdown'

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
        nameSnapshot?: string
      }
    }
  | {
      type: 'system'
      reason?: TaskRunSystemReason
    }

export type TaskRunProgressUnit =
  'item' | 'file' | 'byte' | 'entity' | 'step' | 'package' | 'request'

export type TaskRunRatePeriod = 'second' | 'minute' | 'hour'

export interface TaskRunWarning {
  code?: string
  message: string
}

export interface TaskRunProgressPhase {
  key: string
  label: string
  current?: number
  total?: number
}

export interface TaskRunProgressWork {
  current?: number
  total?: number
  unit?: TaskRunProgressUnit
  ratePeriod?: TaskRunRatePeriod
  indeterminate?: boolean
}

export interface TaskRunProgressWorkMetrics {
  rate?: number
  etaMs?: number
  percent?: number
}

export interface TaskRunProgressUpdate {
  phase?: TaskRunProgressPhase
  work?: TaskRunProgressWork
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}

export interface TaskRunProgress extends Omit<TaskRunProgressUpdate, 'work'> {
  work?: TaskRunProgressWork & TaskRunProgressWorkMetrics
  updatedAt: number
}

export interface TaskRunResult {
  status: TaskRunFinalStatus
  title?: string
  summary?: string
  output?: JsonValue
  error?: string
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}

export type TaskRunSubjectType = 'command' | 'extension'

export interface TaskRunSubject {
  type: TaskRunSubjectType
  id?: string
  labelSnapshot?: string
}

export interface TaskRunControls {
  cancelable?: boolean
  pausable?: boolean
}

export interface TaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string
    message?: string
    showProgress?: boolean
    showResult?: boolean
    closable?: boolean
  }
}

export interface TaskRunSnapshot {
  id: string
  operation: TaskRunOperation
  title: string
  description?: string
  status: TaskRunStatus
  initiator: TaskRunInitiator
  subject?: TaskRunSubject
  controls: Required<TaskRunControls>
  progress?: TaskRunProgress
  result?: TaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}

export interface TaskRunCreateInput {
  operation: TaskRunOperation
  title: string
  description?: string
  initiator?: TaskRunInitiator
  subject?: TaskRunSubject
  controls?: TaskRunControls
  presentation?: TaskRunPresentation
}

export interface TaskRunActiveListQuery {
  operations?: readonly TaskRunOperation[]
  subject?: {
    type: TaskRunSubjectType
    id?: string
  }
  limit?: number
}

export interface TaskRunHistoryListQuery {
  statuses?: readonly TaskRunFinalStatus[]
  operations?: readonly TaskRunOperation[]
  subject?: {
    type: TaskRunSubjectType
    id?: string
  }
  limit?: number
}

export class TaskRunCancellation extends Error {
  override readonly name = 'TaskRunCancellation'

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
