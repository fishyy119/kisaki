import { randomUUID } from 'node:crypto'
import type {
  CommandExecutionProgress,
  CommandExecutionProgressUpdate,
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutionSource,
  CommandExecutionStartResult
} from '@shared/command'
import type { RegisteredCommand } from './registry'

const COMPLETED_EXECUTION_LIMIT = 100

export interface CommandExecutionsOptions {
  getCommand(commandId: string): RegisteredCommand | null
  onStart?(
    started: CommandExecutionStartResult,
    command: RegisteredCommand,
    request: CommandExecutionRequest
  ): void
  onProgress?(progress: CommandExecutionProgress): void
  onFinish?(result: CommandExecutionResult): void
}

interface ActiveCommandExecution {
  commandId: string
  cancelable: boolean
  controller: AbortController
  promise: Promise<CommandExecutionResult>
  progress?: CommandExecutionProgress
  source: CommandExecutionSource
}

export class CommandExecutions {
  private readonly activeExecutions = new Map<string, ActiveCommandExecution>()
  private readonly completedExecutions = new Map<string, CommandExecutionResult>()

  constructor(private readonly options: CommandExecutionsOptions) {}

  start(request: CommandExecutionRequest): CommandExecutionStartResult {
    const command = this.options.getCommand(request.commandId)
    if (!command) {
      throw new Error(`Command "${request.commandId}" is not registered.`)
    }

    const executionId = randomUUID()
    const startedAt = Date.now()
    const controller = new AbortController()
    const source = request.source ?? { kind: 'user' as const }
    const args = {
      ...(command.descriptor.defaultArgs ?? {}),
      ...(request.args ?? {})
    }

    const promise = Promise.resolve()
      .then(() => this.runExecution(command, args, { executionId, startedAt, controller, source }))
      .then((result) => {
        this.rememberCompletedExecution(result)
        this.activeExecutions.delete(executionId)
        this.options.onFinish?.(result)
        return result
      })
      .finally(() => {
        this.activeExecutions.delete(executionId)
      })

    this.activeExecutions.set(executionId, {
      commandId: command.descriptor.id,
      cancelable: command.descriptor.cancelable,
      controller,
      promise,
      source
    })

    const started = {
      commandId: command.descriptor.id,
      executionId,
      startedAt,
      cancelable: command.descriptor.cancelable
    }
    this.options.onStart?.(started, command, request)
    return started
  }

  async wait(executionId: string): Promise<CommandExecutionResult> {
    const active = this.activeExecutions.get(executionId)
    if (active) {
      return active.promise
    }

    const completed = this.completedExecutions.get(executionId)
    if (completed) {
      return completed
    }

    throw new Error(`Command execution "${executionId}" was not found.`)
  }

  async execute(request: CommandExecutionRequest): Promise<CommandExecutionResult> {
    const started = this.start(request)
    return this.wait(started.executionId)
  }

  cancel(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId)
    if (!execution) {
      return false
    }

    if (!execution.cancelable) {
      return false
    }

    execution.controller.abort()
    return true
  }

  getProgress(executionId: string): CommandExecutionProgress | null {
    return this.activeExecutions.get(executionId)?.progress ?? null
  }

  reportProgress(
    commandId: string,
    executionId: string,
    update: CommandExecutionProgressUpdate
  ): CommandExecutionProgress | null {
    const execution = this.activeExecutions.get(executionId)
    if (!execution) {
      return null
    }

    if (execution.commandId !== commandId) {
      throw new Error(
        `Command execution "${executionId}" belongs to "${execution.commandId}", not "${commandId}".`
      )
    }

    const progress: CommandExecutionProgress = {
      ...normalizeProgressUpdate(update),
      commandId,
      executionId,
      source: cloneExecutionSource(execution.source),
      updatedAt: Date.now()
    }
    execution.progress = progress
    this.options.onProgress?.(progress)
    return progress
  }

  isRunning(commandId: string): boolean {
    for (const execution of this.activeExecutions.values()) {
      if (execution.commandId === commandId) {
        return true
      }
    }
    return false
  }

  dispose(): void {
    for (const execution of this.activeExecutions.values()) {
      execution.controller.abort()
    }
    this.activeExecutions.clear()
    this.completedExecutions.clear()
  }

  private async runExecution(
    command: RegisteredCommand,
    args: Record<string, unknown>,
    execution: {
      executionId: string
      startedAt: number
      controller: AbortController
      source: CommandExecutionSource
    }
  ): Promise<CommandExecutionResult> {
    try {
      const output = await command.execute(args, {
        commandId: command.descriptor.id,
        executionId: execution.executionId,
        source: execution.source,
        signal: execution.controller.signal,
        reportProgress: (progress) =>
          this.reportProgress(command.descriptor.id, execution.executionId, progress)
      })

      const finishedAt = Date.now()
      if (execution.controller.signal.aborted) {
        return {
          commandId: command.descriptor.id,
          executionId: execution.executionId,
          startedAt: execution.startedAt,
          finishedAt,
          status: 'cancelled'
        }
      }

      return {
        commandId: command.descriptor.id,
        executionId: execution.executionId,
        startedAt: execution.startedAt,
        finishedAt,
        status: 'completed',
        output
      }
    } catch (error) {
      return {
        commandId: command.descriptor.id,
        executionId: execution.executionId,
        startedAt: execution.startedAt,
        finishedAt: Date.now(),
        status: execution.controller.signal.aborted ? 'cancelled' : 'failed',
        error: toErrorMessage(error)
      }
    }
  }

  private rememberCompletedExecution(result: CommandExecutionResult): void {
    this.completedExecutions.set(result.executionId, result)

    while (this.completedExecutions.size > COMPLETED_EXECUTION_LIMIT) {
      const oldestExecutionId = this.completedExecutions.keys().next().value
      if (!oldestExecutionId) {
        break
      }
      this.completedExecutions.delete(oldestExecutionId)
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cloneExecutionSource(source: CommandExecutionSource): CommandExecutionSource {
  return {
    kind: source.kind,
    extensionId: source.extensionId,
    commandId: source.commandId,
    taskId: source.taskId
  }
}

function normalizeProgressUpdate(
  update: CommandExecutionProgressUpdate
): CommandExecutionProgressUpdate {
  if (!update || typeof update !== 'object' || Array.isArray(update)) {
    throw new Error('Command progress update must be an object.')
  }

  return {
    phase: normalizeOptionalString(update.phase, 'phase'),
    message: normalizeOptionalString(update.message, 'message'),
    current: normalizeOptionalNonNegativeFiniteNumber(update.current, 'current'),
    total: normalizeOptionalNonNegativeFiniteNumber(update.total, 'total'),
    indeterminate: normalizeOptionalBoolean(update.indeterminate, 'indeterminate')
  }
}

function normalizeOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`Command progress "${field}" must be a string.`)
  }

  return value
}

function normalizeOptionalNonNegativeFiniteNumber(
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Command progress "${field}" must be a non-negative finite number.`)
  }

  return value
}

function normalizeOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Command progress "${field}" must be a boolean.`)
  }

  return value
}
