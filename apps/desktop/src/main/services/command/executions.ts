import { randomUUID } from 'node:crypto'
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutionSource,
  CommandExecutionStartResult
} from '@shared/command'
import type { RegisteredCommand } from './registry'

const COMPLETED_EXECUTION_LIMIT = 100

export interface CommandExecutionsOptions {
  getCommand(commandId: string): RegisteredCommand | null
}

interface ActiveCommandExecution {
  commandId: string
  cancelable: boolean
  controller: AbortController
  promise: Promise<CommandExecutionResult>
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
        return result
      })
      .finally(() => {
        this.activeExecutions.delete(executionId)
      })

    this.activeExecutions.set(executionId, {
      commandId: command.descriptor.id,
      cancelable: command.descriptor.cancelable,
      controller,
      promise
    })

    return {
      commandId: command.descriptor.id,
      executionId,
      startedAt,
      cancelable: command.descriptor.cancelable
    }
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
        signal: execution.controller.signal
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
