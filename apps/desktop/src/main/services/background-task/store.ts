import { randomUUID } from 'node:crypto'
import type { DbService } from '@main/services/db'
import { asc, eq } from 'drizzle-orm'
import type {
  BackgroundTask,
  BackgroundTaskCreateInput,
  BackgroundTaskRunRecord,
  BackgroundTaskSchedule,
  BackgroundTaskUpdateInput
} from '@shared/background-task'
import { backgroundTasks, type BackgroundTaskRow, type NewBackgroundTaskRow } from '@shared/db'

const HISTORY_LIMIT = 50

export interface BackgroundTaskStoreOptions {
  db: DbService
  onTaskChanged(taskId: string): void
  onTaskDeleted(taskId: string): void
}

export class BackgroundTaskStore {
  private readonly taskCache = new Map<string, BackgroundTask>()

  constructor(private readonly options: BackgroundTaskStoreOptions) {}

  load(): void {
    const rows = this.options.db.client
      .select()
      .from(backgroundTasks)
      .orderBy(asc(backgroundTasks.createdAt))
      .all()

    for (const row of rows) {
      const task = this.withNextRun(normalizeStoredTask(fromTaskRow(row)))
      this.taskCache.set(task.id, task)
    }
  }

  list(): BackgroundTask[] {
    return [...this.taskCache.values()]
      .map((task) => cloneTask(task))
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  get(taskId: string): BackgroundTask | null {
    const task = this.taskCache.get(taskId)
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
    this.taskCache.set(storedTask.id, storedTask)
    this.persistTask(storedTask)
    this.options.onTaskChanged(storedTask.id)
    return cloneTask(this.requireCachedTask(storedTask.id))
  }

  async update(taskId: string, patch: BackgroundTaskUpdateInput): Promise<BackgroundTask> {
    const task = this.requireCachedTask(taskId)
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
    this.taskCache.set(taskId, storedTask)
    this.persistTask(storedTask)
    this.options.onTaskChanged(taskId)
    return cloneTask(this.requireCachedTask(taskId))
  }

  async setEnabled(taskId: string, enabled: boolean): Promise<BackgroundTask> {
    return this.update(taskId, { enabled })
  }

  async delete(taskId: string): Promise<void> {
    this.taskCache.delete(taskId)
    this.options.db.client.delete(backgroundTasks).where(eq(backgroundTasks.id, taskId)).run()
    this.options.onTaskDeleted(taskId)
  }

  require(taskId: string): BackgroundTask {
    return cloneTask(this.requireCachedTask(taskId))
  }

  listStartupTaskIds(): string[] {
    return [...this.taskCache.values()]
      .filter((task) => task.enabled && task.schedule.type === 'onStartup')
      .map((task) => task.id)
  }

  listTaskIds(): string[] {
    return [...this.taskCache.keys()]
  }

  getScheduledTask(taskId: string): BackgroundTask | null {
    const task = this.taskCache.get(taskId)
    if (
      !task ||
      !task.enabled ||
      task.schedule.type === 'manual' ||
      task.schedule.type === 'onStartup'
    ) {
      return null
    }
    return cloneTask(task)
  }

  async recordRun(taskId: string, record: BackgroundTaskRunRecord): Promise<void> {
    const task = this.requireCachedTask(taskId)
    const nextTask = this.withNextRun({
      ...task,
      lastRunAt: record.finishedAt,
      updatedAt: Date.now(),
      history: [record, ...task.history].slice(0, HISTORY_LIMIT)
    })

    this.taskCache.set(taskId, nextTask)
    this.persistTask(nextTask)
  }

  pauseAfterFailure(taskId: string): void {
    const latest = this.requireCachedTask(taskId)
    const paused = this.withNextRun({ ...latest, enabled: false, updatedAt: Date.now() })
    this.taskCache.set(taskId, paused)
    this.persistTask(paused)
  }

  private requireCachedTask(taskId: string): BackgroundTask {
    const task = this.taskCache.get(taskId)
    if (!task) {
      throw new Error(`Background task "${taskId}" not found.`)
    }
    return task
  }

  private persistTask(task: BackgroundTask): void {
    const values = toTaskRow(task)
    this.options.db.client
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
