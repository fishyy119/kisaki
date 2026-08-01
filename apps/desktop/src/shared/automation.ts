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

export type AutomationOwner =
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

export interface AutomationInvocationError {
  message: string
  code?: string
}

export interface AutomationRunStartedEvent {
  automationId: string
  commandId: string
  trigger: AutomationTrigger
  startedAt: number
}

export interface AutomationRunHistoryRecord {
  id: string
  automationId: string
  automationNameSnapshot: string
  owner: AutomationOwner
  trigger: AutomationTrigger
  attempt: number
  commandId: string
  commandTitleSnapshot?: string
  startedAt: number
  finishedAt: number
  invocationStatus: AutomationCommandInvocationStatus
  error?: AutomationInvocationError
}

export interface AutomationRunHistoryListQuery {
  automationId?: string
  ownerTypes?: AutomationOwner['type'][]
  extensionId?: string
  commandIds?: string[]
  triggers?: AutomationTrigger[]
  invocationStatuses?: AutomationCommandInvocationStatus[]
  limit?: number
}

export interface Automation {
  id: string
  name: string
  owner: AutomationOwner
  commandId: string
  args: Record<string, unknown>
  enabled: boolean
  triggers: AutomationTriggers
  failurePolicy: AutomationFailurePolicy
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  history: AutomationRunHistoryRecord[]
}

export interface AutomationCreateInput {
  name?: string
  owner?: AutomationOwner
  commandId: string
  args?: Record<string, unknown>
  enabled?: boolean
  triggers?: AutomationTriggers
  failurePolicy?: AutomationFailurePolicy
}

export type AutomationUpdateInput = Partial<
  Pick<Automation, 'name' | 'commandId' | 'args' | 'enabled' | 'triggers' | 'failurePolicy'>
>
