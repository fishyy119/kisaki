export type TaskRunCategory = 'scanner' | 'ingest' | 'extension' | 'updater' | 'system'

export type TaskRunContentEntity =
  'game' | 'anime' | 'comic' | 'novel' | 'person' | 'company' | 'character'

export type TaskRunOperation =
  | 'scanner.scan'
  | `ingest.${TaskRunContentEntity}.add`
  | `ingest.${TaskRunContentEntity}.update`
  | `ingest.${TaskRunContentEntity}.batchAdd`
  | `ingest.${TaskRunContentEntity}.batchUpdate`
  | `ingest.${TaskRunContentEntity}.batchDelete`
  | `extension.task.${string}.${string}`
  | 'extension.package.install'
  | 'extension.package.update'
  | 'extension.package.import'
  | 'extension.package.uninstall'
  | 'extension.repository.refresh'
  | 'extension.repository.refreshAll'
  | 'updater.check'
  | 'updater.download'
  | 'system.maintenance'

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
        nameSnapshot?: string
      }
    }
  | {
      type: 'system'
      reason?: TaskRunSystemReason
    }

export type TaskRunOwner =
  | {
      type: 'app'
    }
  | {
      type: 'extension'
      extension: {
        id: string
        nameSnapshot?: string
      }
    }

export type TaskRunSubjectType =
  | 'command'
  | 'automation'
  | 'scanner'
  | 'game'
  | 'anime'
  | 'comic'
  | 'novel'
  | 'person'
  | 'company'
  | 'character'
  | 'extension'
  | 'repository'
  | 'app'

export interface TaskRunSubject {
  type: TaskRunSubjectType
  id?: string
  labelSnapshot?: string
}

export interface TaskRunWarning {
  code?: string
  message: string
}

export type TaskRunProgressUnit =
  'item' | 'file' | 'byte' | 'entity' | 'step' | 'package' | 'request'

export type TaskRunRatePeriod = 'second' | 'minute' | 'hour'

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
  output?: unknown
  error?: string
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}

export interface TaskRunControls {
  cancelable: boolean
  pausable: boolean
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

export interface TaskRun {
  id: string
  category: TaskRunCategory
  operation: TaskRunOperation
  title: string
  description?: string
  status: TaskRunStatus
  owner: TaskRunOwner
  initiator: TaskRunInitiator
  subject?: TaskRunSubject
  controls: TaskRunControls
  progress?: TaskRunProgress
  result?: TaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}

export interface TaskRunStartResult {
  runId: string
  createdAt: number
}

export interface TaskRunSubjectQuery {
  type: TaskRunSubjectType
  id?: string
}

export interface TaskRunActiveListQuery {
  categories?: TaskRunCategory[]
  operations?: TaskRunOperation[]
  ownerTypes?: TaskRunOwner['type'][]
  initiatorTypes?: TaskRunInitiator['type'][]
  automationId?: string
  extensionId?: string
  subject?: TaskRunSubjectQuery
  limit?: number
}

export interface TaskRunHistoryListQuery {
  statuses?: TaskRunFinalStatus[]
  categories?: TaskRunCategory[]
  operations?: TaskRunOperation[]
  ownerTypes?: TaskRunOwner['type'][]
  initiatorTypes?: TaskRunInitiator['type'][]
  automationId?: string
  extensionId?: string
  subject?: TaskRunSubjectQuery
  limit?: number
}
