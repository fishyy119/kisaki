export type CommandDangerLevel = 'none' | 'low' | 'medium' | 'high'

export type CommandAutomationTrigger = 'manual' | 'startup' | 'cron'

export type CommandSystemReason = 'startup' | 'maintenance' | 'update' | 'shutdown'

export type CommandInvocationSource =
  | {
      type: 'user'
    }
  | {
      type: 'automation'
      automation: {
        id: string
        nameSnapshot: string
        trigger: CommandAutomationTrigger
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
      reason?: CommandSystemReason
    }

export interface CommandDescriptor {
  id: string
  title: string
  description?: string
  argsSchema?: Record<string, unknown>
  defaultArgs?: Record<string, unknown>
  dangerLevel: CommandDangerLevel
  ownerExtensionId?: string
}

export type CommandListItem = CommandDescriptor

export interface CommandInvocationRequest {
  commandId: string
  args?: Record<string, unknown>
  source?: CommandInvocationSource
}

export interface CommandInvocationContext {
  commandId: string
  source: CommandInvocationSource
}

export interface CommandInvocationResult {
  commandId: string
  output?: unknown
}
