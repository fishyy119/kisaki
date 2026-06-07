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
  argsSchema?: JsonObject
  defaultArgs?: JsonObject
  dangerLevel: CommandDangerLevel
  ownerExtensionId?: string
}

export type CommandListItem = CommandDescriptor

export interface CommandInvocationRequest {
  commandId: string
  args?: JsonObject
}

export interface CommandInvocationContext {
  commandId: string
  source: CommandInvocationSource
}

export interface CommandInvocationResult {
  commandId: string
  output?: JsonValue
}

export interface CommandsCapability {
  list(): Promise<readonly CommandListItem[]>
  get(commandId: string): Promise<CommandDescriptor | null>
  invoke(request: CommandInvocationRequest): Promise<CommandInvocationResult>
}
