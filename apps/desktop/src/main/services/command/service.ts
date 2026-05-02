import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type {
  CommandDescriptor,
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutionSource,
  CommandExecutionStartResult,
  CommandListItem
} from '@shared/command'

const COMPLETED_EXECUTION_LIMIT = 100

export interface CommandExecutionContext {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  signal: AbortSignal
}

export interface CommandRegistrationInput
  extends
    Omit<Partial<CommandDescriptor>, 'id' | 'title'>,
    Pick<CommandDescriptor, 'id' | 'title'> {
  execute(
    args: Record<string, unknown>,
    context: CommandExecutionContext
  ): Promise<unknown> | unknown
}

interface CommandRegistrationRecord {
  descriptor: CommandDescriptor
  execute: CommandRegistrationInput['execute']
}

interface ActiveCommandExecution {
  commandId: string
  cancelable: boolean
  controller: AbortController
  promise: Promise<CommandExecutionResult>
}

export class CommandService implements IService {
  readonly id = 'command'
  readonly deps = ['ipc'] as const satisfies readonly ServiceName[]

  private ipc!: IpcService
  private readonly commands = new Map<string, CommandRegistrationRecord>()
  private readonly activeExecutions = new Map<string, ActiveCommandExecution>()
  private readonly completedExecutions = new Map<string, CommandExecutionResult>()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipc = container.get('ipc')
    this.setupIpcHandlers()
    log.info('[CommandService] Initialized')
  }

  async dispose(): Promise<void> {
    for (const execution of this.activeExecutions.values()) {
      execution.controller.abort()
    }
    this.activeExecutions.clear()
    this.completedExecutions.clear()
    this.commands.clear()
    log.info('[CommandService] Disposed')
  }

  register(command: CommandRegistrationInput): () => void {
    const descriptor = normalizeCommandDescriptor(command)
    if (this.commands.has(descriptor.id)) {
      throw new Error(`Command "${descriptor.id}" is already registered.`)
    }

    this.commands.set(descriptor.id, {
      descriptor,
      execute: command.execute
    })

    return () => {
      const current = this.commands.get(descriptor.id)
      if (current?.execute === command.execute) {
        this.commands.delete(descriptor.id)
      }
    }
  }

  list(): CommandListItem[] {
    return [...this.commands.values()]
      .map(({ descriptor }) => ({
        ...descriptor,
        running: this.isCommandRunning(descriptor.id)
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  get(commandId: string): CommandDescriptor | null {
    return this.commands.get(commandId)?.descriptor ?? null
  }

  start(request: CommandExecutionRequest): CommandExecutionStartResult {
    const record = this.commands.get(request.commandId)
    if (!record) {
      throw new Error(`Command "${request.commandId}" is not registered.`)
    }

    const executionId = randomUUID()
    const startedAt = Date.now()
    const controller = new AbortController()
    const source = request.source ?? { kind: 'user' as const }
    const args = {
      ...(record.descriptor.defaultArgs ?? {}),
      ...(request.args ?? {})
    }

    const promise = Promise.resolve()
      .then(() => this.runExecution(record, args, { executionId, startedAt, controller, source }))
      .then((result) => {
        this.rememberCompletedExecution(result)
        return result
      })
      .finally(() => {
        this.activeExecutions.delete(executionId)
      })

    this.activeExecutions.set(executionId, {
      commandId: record.descriptor.id,
      cancelable: record.descriptor.cancelable,
      controller,
      promise
    })

    return {
      commandId: record.descriptor.id,
      executionId,
      startedAt,
      cancelable: record.descriptor.cancelable
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

  private async runExecution(
    record: CommandRegistrationRecord,
    args: Record<string, unknown>,
    execution: {
      executionId: string
      startedAt: number
      controller: AbortController
      source: CommandExecutionSource
    }
  ): Promise<CommandExecutionResult> {
    try {
      const output = await record.execute(args, {
        commandId: record.descriptor.id,
        executionId: execution.executionId,
        source: execution.source,
        signal: execution.controller.signal
      })

      const finishedAt = Date.now()
      if (execution.controller.signal.aborted) {
        return {
          commandId: record.descriptor.id,
          executionId: execution.executionId,
          startedAt: execution.startedAt,
          finishedAt,
          status: 'cancelled'
        }
      }

      return {
        commandId: record.descriptor.id,
        executionId: execution.executionId,
        startedAt: execution.startedAt,
        finishedAt,
        status: 'completed',
        output
      }
    } catch (error) {
      return {
        commandId: record.descriptor.id,
        executionId: execution.executionId,
        startedAt: execution.startedAt,
        finishedAt: Date.now(),
        status: execution.controller.signal.aborted ? 'cancelled' : 'failed',
        error: toErrorMessage(error)
      }
    }
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

  private setupIpcHandlers(): void {
    this.ipc.handle('command:list', async () => {
      try {
        return { success: true as const, data: this.list() }
      } catch (error) {
        log.error('[CommandService] command:list failed:', error)
        return { success: false as const, error: 'Could not list commands' }
      }
    })

    this.ipc.handle('command:start', async (_, request) => {
      try {
        return { success: true as const, data: this.start(request) }
      } catch (error) {
        log.error('[CommandService] command:start failed:', error)
        return { success: false as const, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('command:wait', async (_, executionId) => {
      try {
        return { success: true as const, data: await this.wait(executionId) }
      } catch (error) {
        log.error('[CommandService] command:wait failed:', error)
        return { success: false as const, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('command:execute', async (_, request) => {
      try {
        const data = await this.execute(request)
        return { success: true as const, data }
      } catch (error) {
        log.error('[CommandService] command:execute failed:', error)
        return { success: false as const, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('command:cancel', async (_, executionId) => {
      try {
        return { success: true as const, data: this.cancel(executionId) }
      } catch (error) {
        log.error('[CommandService] command:cancel failed:', error)
        return { success: false as const, error: toErrorMessage(error) }
      }
    })
  }

  private isCommandRunning(commandId: string): boolean {
    for (const execution of this.activeExecutions.values()) {
      if (execution.commandId === commandId) {
        return true
      }
    }
    return false
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

function normalizeCommandDescriptor(command: CommandRegistrationInput): CommandDescriptor {
  const id = command.id.trim()
  if (!id) {
    throw new Error('Command id is required.')
  }

  const title = command.title.trim()
  if (!title) {
    throw new Error(`Command "${id}" title is required.`)
  }

  return {
    id,
    title,
    description: command.description,
    argsSchema: command.argsSchema,
    defaultArgs: command.defaultArgs,
    dangerLevel: command.dangerLevel ?? 'none',
    cancelable: command.cancelable ?? false,
    ownerExtensionId: command.ownerExtensionId
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
