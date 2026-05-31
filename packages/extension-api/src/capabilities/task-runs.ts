export type ExtensionTaskRunOperation = string

export type ExtensionTaskRunStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ExtensionTaskRunFinalStatus = Extract<
  ExtensionTaskRunStatus,
  'completed' | 'failed' | 'cancelled'
>

export type ExtensionTaskRunAutomationTrigger = 'manual' | 'startup' | 'cron'

export type ExtensionTaskRunSystemReason = 'startup' | 'maintenance' | 'update' | 'shutdown'

export type ExtensionTaskRunInitiator =
  | {
      type: 'user'
    }
  | {
      type: 'automation'
      automation: {
        id: string
        nameSnapshot: string
        trigger: ExtensionTaskRunAutomationTrigger
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
      reason?: ExtensionTaskRunSystemReason
    }

export type ExtensionTaskRunProgressUnit =
  | 'item'
  | 'file'
  | 'byte'
  | 'entity'
  | 'step'
  | 'package'
  | 'request'

export type ExtensionTaskRunRatePeriod = 'second' | 'minute' | 'hour'

export interface ExtensionTaskRunWarning {
  code?: string
  message: string
}

export interface ExtensionTaskRunProgressUpdate {
  phase?: string
  message?: string
  current?: number
  total?: number
  unit?: ExtensionTaskRunProgressUnit
  ratePeriod?: ExtensionTaskRunRatePeriod
  indeterminate?: boolean
  counters?: Record<string, number>
  warnings?: readonly ExtensionTaskRunWarning[]
}

export interface ExtensionTaskRunProgress extends ExtensionTaskRunProgressUpdate {
  updatedAt: number
  rate?: number
  etaMs?: number
  percent?: number
}

export interface ExtensionTaskRunResult {
  status: ExtensionTaskRunFinalStatus
  title?: string
  summary?: string
  output?: unknown
  error?: string
  counters?: Record<string, number>
  warnings?: readonly ExtensionTaskRunWarning[]
}

export type ExtensionTaskRunSubjectType = 'command' | 'extension'

export interface ExtensionTaskRunSubject {
  type: ExtensionTaskRunSubjectType
  id?: string
  labelSnapshot?: string
}

export interface ExtensionTaskRunControls {
  cancelable?: boolean
  pausable?: boolean
}

export interface ExtensionTaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string
    message?: string
    showProgress?: boolean
    showResult?: boolean
    closable?: boolean
  }
}

export interface ExtensionTaskRunSnapshot {
  id: string
  operation: ExtensionTaskRunOperation
  title: string
  description?: string
  status: ExtensionTaskRunStatus
  initiator: ExtensionTaskRunInitiator
  subject?: ExtensionTaskRunSubject
  controls: Required<ExtensionTaskRunControls>
  progress?: ExtensionTaskRunProgress
  result?: ExtensionTaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}

export interface ExtensionTaskRunCreateInput {
  operation: ExtensionTaskRunOperation
  title: string
  description?: string
  initiator?: ExtensionTaskRunInitiator
  subject?: ExtensionTaskRunSubject
  controls?: ExtensionTaskRunControls
  presentation?: ExtensionTaskRunPresentation
}

export interface ExtensionTaskRunActiveListQuery {
  operations?: readonly ExtensionTaskRunOperation[]
  subject?: {
    type: ExtensionTaskRunSubjectType
    id?: string
  }
  limit?: number
}

export interface ExtensionTaskRunHistoryListQuery {
  statuses?: readonly ExtensionTaskRunFinalStatus[]
  operations?: readonly ExtensionTaskRunOperation[]
  subject?: {
    type: ExtensionTaskRunSubjectType
    id?: string
  }
  limit?: number
}

export class ExtensionTaskRunCancellation extends Error {
  override readonly name = 'ExtensionTaskRunCancellation'

  constructor(message = 'Extension task run was cancelled.') {
    super(message)
  }
}

export function isExtensionTaskRunCancellation(
  error: unknown
): error is ExtensionTaskRunCancellation {
  return error instanceof ExtensionTaskRunCancellation
}

export interface ExtensionTaskRunHandle {
  readonly id: string
  readonly signal: AbortSignal
  report(update: ExtensionTaskRunProgressUpdate): Promise<void>
  checkpoint(): Promise<void>
  complete(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  fail(error: unknown, result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  cancel(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
}

export interface ExtensionTaskRunsCapability {
  create(input: ExtensionTaskRunCreateInput): Promise<ExtensionTaskRunHandle>
  listActiveOwn(
    query?: ExtensionTaskRunActiveListQuery
  ): Promise<readonly ExtensionTaskRunSnapshot[]>
  listHistoryOwn(
    query?: ExtensionTaskRunHistoryListQuery
  ): Promise<readonly ExtensionTaskRunSnapshot[]>
  getActiveOwn(runId: string): Promise<ExtensionTaskRunSnapshot | null>
  getHistoryOwn(runId: string): Promise<ExtensionTaskRunSnapshot | null>
  waitOwn(runId: string): Promise<ExtensionTaskRunSnapshot>
}
