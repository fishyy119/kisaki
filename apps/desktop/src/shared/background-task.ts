export type BackgroundTaskCreatedBy = 'user' | 'extension'

export type BackgroundTaskSchedule =
  | { type: 'manual' }
  | { type: 'onStartup' }
  | { type: 'interval'; everyMs: number }
  | { type: 'daily'; timeOfDay: string }
  | { type: 'weekly'; dayOfWeek: number; timeOfDay: string }

export type BackgroundTaskFailurePolicy =
  | { type: 'none' }
  | { type: 'retry'; retryCount: number; retryDelayMs?: number }
  | { type: 'pauseTask'; retryCount?: number; retryDelayMs?: number }

export type BackgroundTaskRunStatus = 'success' | 'failed' | 'cancelled' | 'skipped'

export interface BackgroundTaskRunRecord {
  id: string
  taskId: string
  commandId: string
  startedAt: number
  finishedAt: number
  status: BackgroundTaskRunStatus
  attempt: number
  trigger: 'manual' | 'startup' | 'schedule'
  output?: unknown
  error?: string
}

export interface BackgroundTask {
  id: string
  name: string
  ownerExtensionId?: string
  createdBy: BackgroundTaskCreatedBy
  commandId: string
  args: Record<string, unknown>
  enabled: boolean
  schedule: BackgroundTaskSchedule
  failurePolicy: BackgroundTaskFailurePolicy
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  history: BackgroundTaskRunRecord[]
}

export interface BackgroundTaskCreateInput {
  name?: string
  ownerExtensionId?: string
  createdBy: BackgroundTaskCreatedBy
  commandId: string
  args?: Record<string, unknown>
  enabled?: boolean
  schedule?: BackgroundTaskSchedule
  failurePolicy?: BackgroundTaskFailurePolicy
}

export type BackgroundTaskUpdateInput = Partial<
  Pick<
    BackgroundTask,
    'name' | 'ownerExtensionId' | 'commandId' | 'args' | 'enabled' | 'schedule' | 'failurePolicy'
  >
>
