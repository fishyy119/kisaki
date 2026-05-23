import { randomUUID } from 'node:crypto'
import type { CommandService } from '@main/services/command'
import type {
  BackgroundTask,
  BackgroundTaskFailurePolicy,
  BackgroundTaskRunRecord
} from '@shared/background-task'
import type { BackgroundTaskStore } from './store'

const DEFAULT_RETRY_DELAY_MS = 5_000

export interface BackgroundTaskRunnerOptions {
  command: CommandService
  store: BackgroundTaskStore
  clearTaskTimer(taskId: string): void
  refreshTaskTimer(taskId: string): void
  onRunStarted(event: {
    taskId: string
    commandId: string
    trigger: BackgroundTaskRunRecord['trigger']
    startedAt: number
  }): void
  onRunFinished(record: BackgroundTaskRunRecord): void
}

export class BackgroundTaskRunner {
  private readonly runningTasks = new Map<
    string,
    { controller: AbortController; commandExecutionId?: string }
  >()

  constructor(private readonly options: BackgroundTaskRunnerOptions) {}

  runNow(taskId: string): Promise<BackgroundTaskRunRecord> {
    return this.runTask(taskId, 'manual')
  }

  runStartup(taskId: string): Promise<BackgroundTaskRunRecord> {
    return this.runTask(taskId, 'startup')
  }

  listRunningTaskIds(): string[] {
    return [...this.runningTasks.keys()]
  }

  runCron(taskId: string): Promise<BackgroundTaskRunRecord> {
    return this.runTask(taskId, 'cron')
  }

  cancel(taskId: string): boolean {
    const running = this.runningTasks.get(taskId)
    if (!running) {
      return false
    }

    running.controller.abort()
    return running.commandExecutionId
      ? this.options.command.executions.cancel(running.commandExecutionId)
      : true
  }

  dispose(): void {
    for (const running of this.runningTasks.values()) {
      running.controller.abort()
      if (running.commandExecutionId) {
        this.options.command.executions.cancel(running.commandExecutionId)
      }
    }
    this.runningTasks.clear()
  }

  private async runTask(
    taskId: string,
    trigger: BackgroundTaskRunRecord['trigger']
  ): Promise<BackgroundTaskRunRecord> {
    const task = this.options.store.require(taskId)
    if (this.runningTasks.has(taskId)) {
      const record = createSkippedRecord(task, trigger, 'Task is already running.')
      await this.options.store.recordRun(taskId, record)
      return record
    }

    if (!task.enabled && trigger !== 'manual') {
      const record = createSkippedRecord(task, trigger, 'Task is disabled.')
      await this.options.store.recordRun(taskId, record)
      return record
    }

    const taskController = new AbortController()
    this.runningTasks.set(taskId, { controller: taskController })
    this.options.clearTaskTimer(taskId)
    this.options.onRunStarted({
      taskId: task.id,
      commandId: task.commandId,
      trigger,
      startedAt: Date.now()
    })

    try {
      const attempts = getAttemptCount(task.failurePolicy)
      let lastRecord: BackgroundTaskRunRecord | null = null

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (taskController.signal.aborted) {
          lastRecord = createCancelledRecord(task, trigger)
          break
        }

        const startedAt = Date.now()
        const execution = this.options.command.executions.start({
          commandId: task.commandId,
          args: task.args,
          source: {
            kind: 'background-task',
            extensionId: task.ownerExtensionId,
            taskId: task.id,
            commandId: task.commandId
          },
          presentation: {
            notify: {
              enabled: false
            }
          }
        })
        this.runningTasks.set(taskId, {
          controller: taskController,
          commandExecutionId: execution.executionId
        })
        const result = await this.options.command.executions.wait(execution.executionId)

        lastRecord = {
          id: randomUUID(),
          taskId: task.id,
          commandId: task.commandId,
          startedAt,
          finishedAt: Date.now(),
          status:
            result.status === 'completed'
              ? 'success'
              : result.status === 'cancelled'
                ? 'cancelled'
                : 'failed',
          attempt,
          trigger,
          output: toStoredValue(result.output),
          error: result.error
        }

        if (taskController.signal.aborted && lastRecord.status !== 'cancelled') {
          lastRecord = {
            ...lastRecord,
            status: 'cancelled',
            error: lastRecord.error ?? 'Task was cancelled.'
          }
        }

        if (lastRecord.status === 'success' || lastRecord.status === 'cancelled') {
          break
        }

        if (attempt < attempts) {
          const delayFinished = await delay(
            getRetryDelay(task.failurePolicy),
            taskController.signal
          )
          if (!delayFinished) {
            lastRecord = createCancelledRecord(task, trigger)
            break
          }
        }
      }

      const record = lastRecord ?? createSkippedRecord(task, trigger, 'No attempts ran.')
      await this.options.store.recordRun(taskId, record)
      this.options.onRunFinished(record)

      if (record.status === 'failed' && task.failurePolicy.type === 'pauseTask') {
        this.options.store.pauseAfterFailure(taskId)
      }

      return record
    } catch (error) {
      const record = createFailureRecord(task, trigger, error)
      await this.options.store.recordRun(taskId, record)
      this.options.onRunFinished(record)
      return record
    } finally {
      this.runningTasks.delete(taskId)
      this.options.refreshTaskTimer(taskId)
    }
  }
}

function createSkippedRecord(
  task: BackgroundTask,
  trigger: BackgroundTaskRunRecord['trigger'],
  error: string
): BackgroundTaskRunRecord {
  const now = Date.now()
  return {
    id: randomUUID(),
    taskId: task.id,
    commandId: task.commandId,
    startedAt: now,
    finishedAt: now,
    status: 'skipped',
    attempt: 0,
    trigger,
    error
  }
}

function createFailureRecord(
  task: BackgroundTask,
  trigger: BackgroundTaskRunRecord['trigger'],
  error: unknown
): BackgroundTaskRunRecord {
  const now = Date.now()
  return {
    id: randomUUID(),
    taskId: task.id,
    commandId: task.commandId,
    startedAt: now,
    finishedAt: now,
    status: 'failed',
    attempt: 1,
    trigger,
    error: toErrorMessage(error)
  }
}

function createCancelledRecord(
  task: BackgroundTask,
  trigger: BackgroundTaskRunRecord['trigger']
): BackgroundTaskRunRecord {
  const now = Date.now()
  return {
    id: randomUUID(),
    taskId: task.id,
    commandId: task.commandId,
    startedAt: now,
    finishedAt: now,
    status: 'cancelled',
    attempt: 0,
    trigger,
    error: 'Task was cancelled.'
  }
}

function getAttemptCount(policy: BackgroundTaskFailurePolicy): number {
  if (policy.type === 'none') {
    return 1
  }
  return Math.max(1, (policy.retryCount ?? 0) + 1)
}

function getRetryDelay(policy: BackgroundTaskFailurePolicy): number {
  if (policy.type === 'none') {
    return 0
  }
  return Math.max(0, policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)
}

function delay(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(true)
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      cleanup()
      resolve(false)
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function toStoredValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
