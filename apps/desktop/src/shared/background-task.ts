export type BackgroundTaskCreatedBy = 'user' | 'extension'

export interface BackgroundTaskCronTrigger {
  expression: string
  timezone?: string
}

export interface BackgroundTaskTriggers {
  onStartup: boolean
  cron?: BackgroundTaskCronTrigger
}

export type BackgroundTaskFailurePolicy =
  | { type: 'none' }
  | { type: 'retry'; retryCount: number; retryDelayMs?: number }
  | { type: 'pauseTask'; retryCount?: number; retryDelayMs?: number }

export type BackgroundTaskRunStatus = 'success' | 'failed' | 'cancelled' | 'skipped'
export type BackgroundTaskRunTrigger = 'manual' | 'startup' | 'cron'

export interface BackgroundTaskRunRecord {
  id: string
  taskId: string
  commandId: string
  startedAt: number
  finishedAt: number
  status: BackgroundTaskRunStatus
  attempt: number
  trigger: BackgroundTaskRunTrigger
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
  triggers: BackgroundTaskTriggers
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
  triggers?: BackgroundTaskTriggers
  failurePolicy?: BackgroundTaskFailurePolicy
}

export type BackgroundTaskUpdateInput = Partial<
  Pick<
    BackgroundTask,
    'name' | 'ownerExtensionId' | 'commandId' | 'args' | 'enabled' | 'triggers' | 'failurePolicy'
  >
>
