import type { JsonObject, JsonValue } from '../shared'

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
        nameSnapshot?: string | undefined
      }
    }
  | {
      type: 'system'
      reason?: CommandSystemReason | undefined
    }

export interface CommandDescriptor {
  id: string
  title: string
  description?: string | undefined
  argsSchema?: JsonObject | undefined
  defaultArgs?: JsonObject | undefined
  dangerLevel: CommandDangerLevel
  ownerExtensionId?: string | undefined
}

export type CommandListItem = CommandDescriptor

export interface CommandInvocationRequest {
  commandId: string
  args?: JsonObject | undefined
}

export interface CommandInvocationContext {
  commandId: string
  source: CommandInvocationSource
}

export interface CommandInvocationResult {
  commandId: string
  output?: JsonValue | undefined
}

export interface CommandsCapability {
  list(): Promise<readonly CommandListItem[]>
  get(commandId: string): Promise<CommandDescriptor | null>
  invoke(request: CommandInvocationRequest): Promise<CommandInvocationResult>
}
