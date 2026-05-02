import type { SerializableRecord, SerializableValue } from '../shared'

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
  argsSchema?: SerializableRecord
  defaultArgs?: SerializableRecord
  dangerLevel: CommandDangerLevel
  cancelable: boolean
  ownerExtensionId?: string
}

export interface CommandListItem extends CommandDescriptor {
  running: boolean
}

export interface CommandExecutionRequest {
  commandId: string
  args?: SerializableRecord
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
  output?: SerializableValue
  error?: string
}

export interface CommandExecutionContext {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  signal: AbortSignal
}

export interface CommandsCapability {
  list(): Promise<readonly CommandListItem[]>
  get(commandId: string): Promise<CommandDescriptor | null>
  start(request: CommandExecutionRequest): Promise<CommandExecutionStartResult>
  wait(executionId: string): Promise<CommandExecutionResult>
  execute(request: CommandExecutionRequest): Promise<CommandExecutionResult>
  cancel(executionId: string): Promise<boolean>
}
