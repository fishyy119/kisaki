import type { SerializableRecord } from '../shared'

export interface AutomationCronTrigger {
  expression: string
  timezone?: string
}

export interface AutomationTriggers {
  onStartup: boolean
  cron?: AutomationCronTrigger
}

export type AutomationFailurePolicy =
  | { type: 'none' }
  | { type: 'retry'; retryCount: number; retryDelayMs?: number }
  | { type: 'pauseAutomation'; retryCount?: number; retryDelayMs?: number }

export type AutomationTrigger = 'manual' | 'startup' | 'cron'

export type AutomationCommandInvocationStatus = 'completed' | 'failed'

export interface AutomationInvocationError {
  message: string
  code?: string
}

export interface AutomationRunHistoryRecord {
  id: string
  automationId: string
  automationNameSnapshot: string
  commandId: string
  commandTitleSnapshot?: string
  startedAt: number
  finishedAt: number
  invocationStatus: AutomationCommandInvocationStatus
  attempt: number
  trigger: AutomationTrigger
  error?: AutomationInvocationError
}

export interface Automation {
  id: string
  name: string
  commandId: string
  args: SerializableRecord
  enabled: boolean
  triggers: AutomationTriggers
  failurePolicy: AutomationFailurePolicy
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  history: readonly AutomationRunHistoryRecord[]
}

export interface AutomationCreateInput {
  name?: string
  commandId: string
  args?: SerializableRecord
  enabled?: boolean
  triggers?: AutomationTriggers
  failurePolicy?: AutomationFailurePolicy
}

export type AutomationUpdateInput = Partial<
  Pick<Automation, 'name' | 'commandId' | 'args' | 'enabled' | 'triggers' | 'failurePolicy'>
>

export interface AutomationsCapability {
  list(): Promise<readonly Automation[]>
  get(automationId: string): Promise<Automation | null>
  create(input: AutomationCreateInput): Promise<Automation>
  update(automationId: string, patch: AutomationUpdateInput): Promise<Automation>
  setEnabled(automationId: string, enabled: boolean): Promise<Automation>
  delete(automationId: string): Promise<void>
  run(automationId: string): Promise<AutomationRunHistoryRecord | null>
}
