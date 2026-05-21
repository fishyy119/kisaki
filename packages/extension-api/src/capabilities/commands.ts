import type { SerializableRecord, SerializableValue } from '../shared'

export type CommandDangerLevel = 'none' | 'low' | 'medium' | 'high'

export type CommandExecutionStatus = 'completed' | 'cancelled' | 'failed'
export type CommandExecutionState = 'running' | 'cancelling'
export type CommandListItemState = 'idle' | CommandExecutionState

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
  notification?: CommandNotificationTemplate
}

export interface CommandListItem extends CommandDescriptor {
  state: CommandListItemState
}

export interface CommandExecutionRequest {
  commandId: string
  args?: SerializableRecord
  presentation?: CommandExecutionPresentation
}

export interface CommandNotificationTemplate {
  title?: string
  startMessage?: string
  successTitle?: string
  successMessage?: string
  cancelledTitle?: string
  cancelledMessage?: string
  failedTitle?: string
  failedMessage?: string
}

export interface CommandExecutionNotifyPresentation {
  enabled: boolean
  title?: string
  message?: string
  cancelable?: boolean
}

export interface CommandExecutionPresentation {
  notify?: CommandExecutionNotifyPresentation
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
  state: CommandExecutionState
  source: CommandExecutionSource
  updatedAt: number
}

export interface CommandExecutionStartResult {
  commandId: string
  executionId: string
  startedAt: number
  cancelable: boolean
  state: CommandExecutionState
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
  reportProgress(progress: CommandExecutionProgressUpdate): void
}

export interface CommandsCapability {
  list(): Promise<readonly CommandListItem[]>
  get(commandId: string): Promise<CommandDescriptor | null>
  start(request: CommandExecutionRequest): Promise<CommandExecutionStartResult>
  wait(executionId: string): Promise<CommandExecutionResult>
  getProgress(executionId: string): Promise<CommandExecutionProgress | null>
  execute(request: CommandExecutionRequest): Promise<CommandExecutionResult>
  cancel(executionId: string): Promise<boolean>
}
