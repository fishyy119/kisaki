import { randomUUID } from 'node:crypto'
import { createLogger } from '@main/log'
import { asc, eq } from 'drizzle-orm'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { CommandService } from '@main/services/command'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type {
  BackgroundTask,
  BackgroundTaskCreateInput,
  BackgroundTaskFailurePolicy,
  BackgroundTaskRunRecord,
  BackgroundTaskSchedule,
  BackgroundTaskUpdateInput
} from '@shared/background-task'
import { backgroundTasks, type BackgroundTaskRow, type NewBackgroundTaskRow } from '@shared/db'
import { registerBackgroundTaskIpc } from './ipc'

const log = createLogger('BackgroundTask')

const HISTORY_LIMIT = 50
const DEFAULT_RETRY_DELAY_MS = 5_000
const MAX_TIMEOUT_MS = 2_147_483_647

export class BackgroundTaskService implements IService {
  readonly id = 'background-task'
  readonly deps = ['db', 'ipc', 'event', 'command'] as const satisfies readonly ServiceName[]

  private db!: DbService
  private event!: EventService
  private command!: CommandService
  private readonly tasks = new Map<string, BackgroundTask>()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly runningTasks = new Map<
    string,
    { controller: AbortController; commandExecutionId?: string }
  >()
  private unsubscribeAppReady: (() => void) | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.db = container.get('db')
    this.event = container.get('event')
    this.command = container.get('command')

    this.load()
    registerBackgroundTaskIpc(this, container.get('ipc'))
    this.unsubscribeAppReady = this.event.bus.on('app:ready', () => {
      void this.runStartupTasks().catch((error) => {
        log.error('Startup tasks failed:', error)
      })
    })
    this.refreshAllTimers()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.unsubscribeAppReady?.()
    this.unsubscribeAppReady = null
    this.clearTimers()
    for (const running of this.runningTasks.values()) {
      running.controller.abort()
      if (running.commandExecutionId) {
        this.command.executions.cancel(running.commandExecutionId)
      }
    }
    this.runningTasks.clear()
    log.info('Disposed')
  }

  list(): BackgroundTask[] {
    return [...this.tasks.values()]
      .map((task) => cloneTask(task))
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  get(taskId: string): BackgroundTask | null {
    const task = this.tasks.get(taskId)
    return task ? cloneTask(task) : null
  }

  async create(input: BackgroundTaskCreateInput): Promise<BackgroundTask> {
    const now = Date.now()
    const task: BackgroundTask = {
      id: randomUUID(),
      name: input.name?.trim() || input.commandId,
      ownerExtensionId: input.ownerExtensionId,
      createdBy: input.createdBy,
      commandId: input.commandId,
      args: input.args ?? {},
      enabled: input.enabled ?? true,
      schedule: input.schedule ?? { type: 'manual' },
      failurePolicy: input.failurePolicy ?? { type: 'none' },
      createdAt: now,
      updatedAt: now,
      history: []
    }

    const storedTask = this.withNextRun(task)
    this.tasks.set(storedTask.id, storedTask)
    this.persistTask(storedTask)
    this.refreshTaskTimer(task.id)
    return cloneTask(this.requireTask(task.id))
  }

  async update(taskId: string, patch: BackgroundTaskUpdateInput): Promise<BackgroundTask> {
    const task = this.requireTask(taskId)
    const updated: BackgroundTask = {
      ...task,
      ...patch,
      name: patch.name?.trim() || task.name,
      args: patch.args ?? task.args,
      schedule: patch.schedule ?? task.schedule,
      failurePolicy: patch.failurePolicy ?? task.failurePolicy,
      enabled: patch.enabled === undefined ? task.enabled : patch.enabled,
      updatedAt: Date.now()
    }

    const storedTask = this.withNextRun(updated)
    this.tasks.set(taskId, storedTask)
    this.persistTask(storedTask)
    this.refreshTaskTimer(taskId)
    return cloneTask(this.requireTask(taskId))
  }

  async setEnabled(taskId: string, enabled: boolean): Promise<BackgroundTask> {
    return this.update(taskId, { enabled })
  }

  async delete(taskId: string): Promise<void> {
    this.clearTaskTimer(taskId)
    this.tasks.delete(taskId)
    this.db.client.delete(backgroundTasks).where(eq(backgroundTasks.id, taskId)).run()
  }

  async runNow(taskId: string): Promise<BackgroundTaskRunRecord> {
    return this.runTask(taskId, 'manual')
  }

  cancel(taskId: string): boolean {
    const running = this.runningTasks.get(taskId)
    if (!running) {
      return false
    }

    running.controller.abort()
    return running.commandExecutionId
      ? this.command.executions.cancel(running.commandExecutionId)
      : true
  }

  private async runStartupTasks(): Promise<void> {
    const startupTaskIds = [...this.tasks.values()]
      .filter((task) => task.enabled && task.schedule.type === 'onStartup')
      .map((task) => task.id)

    for (const taskId of startupTaskIds) {
      await this.runTask(taskId, 'startup').catch((error) => {
        log.error('Startup task failed.', error, { taskId: taskId })
      })
    }
  }

  private async runTask(
    taskId: string,
    trigger: BackgroundTaskRunRecord['trigger']
  ): Promise<BackgroundTaskRunRecord> {
    const task = this.requireTask(taskId)
    if (this.runningTasks.has(taskId)) {
      const record = this.createSkippedRecord(task, trigger, 'Task is already running.')
      await this.recordRun(taskId, record)
      return record
    }

    if (!task.enabled && trigger !== 'manual') {
      const record = this.createSkippedRecord(task, trigger, 'Task is disabled.')
      await this.recordRun(taskId, record)
      return record
    }

    const taskController = new AbortController()
    this.runningTasks.set(taskId, { controller: taskController })
    this.clearTaskTimer(taskId)

    try {
      const attempts = getAttemptCount(task.failurePolicy)
      let lastRecord: BackgroundTaskRunRecord | null = null

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (taskController.signal.aborted) {
          lastRecord = this.createCancelledRecord(task, trigger)
          break
        }

        const startedAt = Date.now()
        const execution = this.command.executions.start({
          commandId: task.commandId,
          args: task.args,
          source: {
            kind: 'background-task',
            extensionId: task.ownerExtensionId,
            taskId: task.id,
            commandId: task.commandId
          }
        })
        this.runningTasks.set(taskId, {
          controller: taskController,
          commandExecutionId: execution.executionId
        })
        const result = await this.command.executions.wait(execution.executionId)

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
            lastRecord = this.createCancelledRecord(task, trigger)
            break
          }
        }
      }

      const record = lastRecord ?? this.createSkippedRecord(task, trigger, 'No attempts ran.')
      await this.recordRun(taskId, record)

      if (record.status === 'failed' && task.failurePolicy.type === 'pauseTask') {
        const latest = this.requireTask(taskId)
        const paused = this.withNextRun({ ...latest, enabled: false, updatedAt: Date.now() })
        this.tasks.set(taskId, paused)
        this.persistTask(paused)
      }

      return record
    } catch (error) {
      const record = this.createFailureRecord(task, trigger, error)
      await this.recordRun(taskId, record)
      return record
    } finally {
      this.runningTasks.delete(taskId)
      this.refreshTaskTimer(taskId)
    }
  }

  private async recordRun(taskId: string, record: BackgroundTaskRunRecord): Promise<void> {
    const task = this.requireTask(taskId)
    const nextTask = this.withNextRun({
      ...task,
      lastRunAt: record.finishedAt,
      updatedAt: Date.now(),
      history: [record, ...task.history].slice(0, HISTORY_LIMIT)
    })

    this.tasks.set(taskId, nextTask)
    this.persistTask(nextTask)
  }

  private load(): void {
    const rows = this.db.client
      .select()
      .from(backgroundTasks)
      .orderBy(asc(backgroundTasks.createdAt))
      .all()

    for (const row of rows) {
      const task = this.withNextRun(normalizeStoredTask(fromTaskRow(row)))
      this.tasks.set(task.id, task)
    }
  }

  private persistTask(task: BackgroundTask): void {
    const values = toTaskRow(task)
    this.db.client
      .insert(backgroundTasks)
      .values(values)
      .onConflictDoUpdate({
        target: backgroundTasks.id,
        set: {
          name: values.name,
          ownerExtensionId: values.ownerExtensionId,
          createdBy: values.createdBy,
          commandId: values.commandId,
          args: values.args,
          enabled: values.enabled,
          schedule: values.schedule,
          failurePolicy: values.failurePolicy,
          updatedAt: values.updatedAt,
          lastRunAt: values.lastRunAt,
          nextRunAt: values.nextRunAt,
          history: values.history
        }
      })
      .run()
  }

  private refreshAllTimers(): void {
    this.clearTimers()
    for (const taskId of this.tasks.keys()) {
      this.refreshTaskTimer(taskId)
    }
  }

  private refreshTaskTimer(taskId: string): void {
    this.clearTaskTimer(taskId)
    const task = this.tasks.get(taskId)
    if (
      !task ||
      !task.enabled ||
      task.schedule.type === 'manual' ||
      task.schedule.type === 'onStartup'
    ) {
      return
    }

    const nextRunAt = task.nextRunAt ?? computeNextRunAt(task.schedule, Date.now())
    if (!nextRunAt) {
      return
    }

    const delayMs = Math.max(0, Math.min(nextRunAt - Date.now(), MAX_TIMEOUT_MS))
    const timer = setTimeout(() => {
      void this.runTask(taskId, 'schedule').catch((error) => {
        log.error('Scheduled task failed.', error, { taskId: taskId })
      })
    }, delayMs)
    this.timers.set(taskId, timer)
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }

  private clearTaskTimer(taskId: string): void {
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
    }
  }

  private withNextRun(task: BackgroundTask): BackgroundTask {
    const nextRunAt =
      task.enabled && task.schedule.type !== 'manual' && task.schedule.type !== 'onStartup'
        ? computeNextRunAt(task.schedule, Date.now())
        : undefined

    if (nextRunAt === undefined) {
      const withoutNextRunAt = { ...task }
      delete withoutNextRunAt.nextRunAt
      return withoutNextRunAt
    }

    return { ...task, nextRunAt }
  }

  private requireTask(taskId: string): BackgroundTask {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Background task "${taskId}" not found.`)
    }
    return task
  }

  private createSkippedRecord(
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

  private createFailureRecord(
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

  private createCancelledRecord(
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
}

function normalizeStoredTask(task: BackgroundTask): BackgroundTask {
  return {
    ...task,
    args: task.args ?? {},
    enabled: task.enabled ?? true,
    schedule: task.schedule ?? { type: 'manual' },
    failurePolicy: task.failurePolicy ?? { type: 'none' },
    history: task.history ?? []
  }
}

function fromTaskRow(row: BackgroundTaskRow): BackgroundTask {
  return {
    id: row.id,
    name: row.name,
    ownerExtensionId: row.ownerExtensionId ?? undefined,
    createdBy: row.createdBy,
    commandId: row.commandId,
    args: row.args,
    enabled: row.enabled,
    schedule: row.schedule,
    failurePolicy: row.failurePolicy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt ?? undefined,
    nextRunAt: row.nextRunAt ?? undefined,
    history: row.history
  }
}

function toTaskRow(task: BackgroundTask): NewBackgroundTaskRow {
  return {
    id: task.id,
    name: task.name,
    ownerExtensionId: task.ownerExtensionId ?? null,
    createdBy: task.createdBy,
    commandId: task.commandId,
    args: task.args,
    enabled: task.enabled,
    schedule: task.schedule,
    failurePolicy: task.failurePolicy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastRunAt: task.lastRunAt ?? null,
    nextRunAt: task.nextRunAt ?? null,
    history: task.history
  }
}

function cloneTask(task: BackgroundTask): BackgroundTask {
  return JSON.parse(JSON.stringify(task)) as BackgroundTask
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

function computeNextRunAt(schedule: BackgroundTaskSchedule, from: number): number | undefined {
  switch (schedule.type) {
    case 'manual':
    case 'onStartup':
      return undefined
    case 'interval':
      return from + Math.max(1_000, schedule.everyMs)
    case 'daily':
      return computeNextTimeOfDay(schedule.timeOfDay, from)
    case 'weekly':
      return computeNextWeeklyTime(schedule.dayOfWeek, schedule.timeOfDay, from)
  }
}

function computeNextTimeOfDay(timeOfDay: string, from: number): number {
  const { hours, minutes } = parseTimeOfDay(timeOfDay)
  const candidate = new Date(from)
  candidate.setHours(hours, minutes, 0, 0)
  if (candidate.getTime() <= from) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate.getTime()
}

function computeNextWeeklyTime(dayOfWeek: number, timeOfDay: string, from: number): number {
  const { hours, minutes } = parseTimeOfDay(timeOfDay)
  const candidate = new Date(from)
  const normalizedDay = Math.max(0, Math.min(6, Math.trunc(dayOfWeek)))
  candidate.setHours(hours, minutes, 0, 0)
  const dayDelta = (normalizedDay - candidate.getDay() + 7) % 7
  candidate.setDate(candidate.getDate() + dayDelta)
  if (candidate.getTime() <= from) {
    candidate.setDate(candidate.getDate() + 7)
  }
  return candidate.getTime()
}

function parseTimeOfDay(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) {
    return { hours: 0, minutes: 0 }
  }

  return {
    hours: Math.max(0, Math.min(23, Number(match[1]))),
    minutes: Math.max(0, Math.min(59, Number(match[2])))
  }
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
