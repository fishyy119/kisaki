import type { SerializableRecord, SerializableValue } from '../shared'

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
  output?: SerializableValue
  error?: string
}

export interface BackgroundTask {
  id: string
  name: string
  ownerExtensionId?: string
  createdBy: BackgroundTaskCreatedBy
  commandId: string
  args: SerializableRecord
  enabled: boolean
  schedule: BackgroundTaskSchedule
  failurePolicy: BackgroundTaskFailurePolicy
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  history: readonly BackgroundTaskRunRecord[]
}

export interface BackgroundTaskCreateInput {
  name?: string
  commandId: string
  args?: SerializableRecord
  enabled?: boolean
  schedule?: BackgroundTaskSchedule
  failurePolicy?: BackgroundTaskFailurePolicy
}

export type BackgroundTaskUpdateInput = Partial<
  Pick<BackgroundTask, 'name' | 'commandId' | 'args' | 'enabled' | 'schedule' | 'failurePolicy'>
>

export interface BackgroundTasksCapability {
  list(): Promise<readonly BackgroundTask[]>
  get(taskId: string): Promise<BackgroundTask | null>
  create(input: BackgroundTaskCreateInput): Promise<BackgroundTask>
  update(taskId: string, patch: BackgroundTaskUpdateInput): Promise<BackgroundTask>
  setEnabled(taskId: string, enabled: boolean): Promise<BackgroundTask>
  delete(taskId: string): Promise<void>
  run(taskId: string): Promise<BackgroundTaskRunRecord>
  cancel(taskId: string): Promise<boolean>
}
