import { randomUUID } from 'node:crypto'
import type { DbService } from '@main/services/db'
import { asc, eq } from 'drizzle-orm'
import type {
  BackgroundTask,
  BackgroundTaskCreateInput,
  BackgroundTaskRunRecord,
  BackgroundTaskTriggers,
  BackgroundTaskUpdateInput
} from '@shared/background-task'
import { backgroundTasks, type BackgroundTaskRow, type NewBackgroundTaskRow } from '@shared/db'
import { assertValidCronTrigger, computeNextCronRunAt } from './cron'

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
      triggers: normalizeTriggers(input.triggers),
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
      triggers: patch.triggers === undefined ? task.triggers : normalizeTriggers(patch.triggers),
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
      .filter((task) => task.enabled && task.triggers.onStartup)
      .map((task) => task.id)
  }

  listTaskIds(): string[] {
    return [...this.taskCache.keys()]
  }

  getScheduledTask(taskId: string): BackgroundTask | null {
    const task = this.taskCache.get(taskId)
    if (!task || !task.enabled || !task.triggers.cron) {
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
    this.options.onTaskChanged(taskId)
  }

  pauseAfterFailure(taskId: string): void {
    const latest = this.requireCachedTask(taskId)
    const paused = this.withNextRun({ ...latest, enabled: false, updatedAt: Date.now() })
    this.taskCache.set(taskId, paused)
    this.persistTask(paused)
    this.options.onTaskChanged(taskId)
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
          triggers: values.triggers,
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
      task.enabled && task.triggers.cron
        ? computeNextCronRunAt(task.triggers.cron, Date.now())
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
    triggers: normalizeTriggers(task.triggers, { validateCron: false }),
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
    triggers: row.triggers,
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
    triggers: task.triggers,
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

function normalizeTriggers(
  triggers: BackgroundTaskTriggers | undefined,
  options: { validateCron?: boolean } = {}
): BackgroundTaskTriggers {
  const normalized: BackgroundTaskTriggers = {
    onStartup: triggers?.onStartup ?? false
  }

  const cron = triggers?.cron
  if (!cron) {
    return normalized
  }

  const expression = cron.expression.trim()
  if (!expression) {
    return normalized
  }

  const timezone = cron.timezone?.trim()
  normalized.cron = timezone ? { expression, timezone } : { expression }
  if (options.validateCron !== false) {
    assertValidCronTrigger(normalized.cron)
  } else if (computeNextCronRunAt(normalized.cron, Date.now()) === undefined) {
    delete normalized.cron
  }
  return normalized
}
