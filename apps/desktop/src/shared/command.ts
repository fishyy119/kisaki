export type CommandDangerLevel = 'none' | 'low' | 'medium' | 'high'

export type CommandExecutionStatus = 'completed' | 'cancelled' | 'failed'

export type CommandExecutionSourceKind = 'user' | 'extension' | 'background-task' | 'system'

export interface CommandExecutionSource {
  kind: CommandExecutionSourceKind
  extensionId?: string
  commandId?: string
  taskId?: string
}

export interface CommandDescriptor {
  id: string
  title: string
  description?: string
  argsSchema?: Record<string, unknown>
  defaultArgs?: Record<string, unknown>
  dangerLevel: CommandDangerLevel
  cancelable: boolean
  ownerExtensionId?: string
}

export interface CommandListItem extends CommandDescriptor {
  running: boolean
}

export interface CommandExecutionRequest {
  commandId: string
  args?: Record<string, unknown>
  source?: CommandExecutionSource
}

export interface CommandExecutionProgressUpdate {
  phase?: string
  message?: string
  current?: number
  total?: number
  indeterminate?: boolean
}

export interface CommandExecutionProgress extends CommandExecutionProgressUpdate {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  updatedAt: number
}

export interface CommandExecutionStartResult {
  commandId: string
  executionId: string
  startedAt: number
  cancelable: boolean
}

export interface CommandExecutionResult {
  commandId: string
  executionId: string
  startedAt: number
  finishedAt: number
  status: CommandExecutionStatus
  output?: unknown
  error?: string
}
