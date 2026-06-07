import { eq, inArray } from 'drizzle-orm'
import { measureJsonBytes } from '@kisaki3/extension-api'
import type { TaskRun, TaskRunFinalStatus, TaskRunHistoryListQuery } from '@shared/task-run'
import { taskRunHistory, type NewTaskRunHistoryRow, type TaskRunHistoryRow } from '@shared/db'
import type { DbContext } from '@main/services/db/types'
import { selectTaskRunHistoryPruneIds } from './retention'

const MAX_HISTORY_JSON_BYTES = 256 * 1024
const MAX_LIST_LIMIT = 500

export interface TaskRunHistoryStoreOptions {
  onDeleted?(runIds: readonly string[]): void
}

export class TaskRunHistoryStore {
  constructor(
    private readonly db: DbContext,
    private readonly options: TaskRunHistoryStoreOptions = {}
  ) {}

  get(runId: string): TaskRun | null {
    const row = this.db.select().from(taskRunHistory).where(eq(taskRunHistory.id, runId)).get()
    return row ? fromHistoryRow(row) : null
  }

  list(query?: TaskRunHistoryListQuery): TaskRun[] {
    return applyListLimit(
      this.listAll()
        .filter((run) => matchesHistoryQuery(run, query))
        .sort((left, right) => (right.finishedAt ?? 0) - (left.finishedAt ?? 0)),
      query?.limit
    )
  }

  saveFinal(run: TaskRun): void {
    assertFinalSnapshot(run)
    const row = toHistoryRow(run)
    assertJsonStorageWithinLimit(row.progress, 'Task run progress')
    assertJsonStorageWithinLimit(row.result, 'Task run result')
    assertJsonStorageWithinLimit(row.owner, 'Task run owner')
    assertJsonStorageWithinLimit(row.initiator, 'Task run initiator')
    assertJsonStorageWithinLimit(row.subject, 'Task run subject')
    assertJsonStorageWithinLimit(row.controls, 'Task run controls')

    this.db
      .insert(taskRunHistory)
      .values(row)
      .onConflictDoUpdate({
        target: taskRunHistory.id,
        set: {
          category: row.category,
          operation: row.operation,
          title: row.title,
          description: row.description,
          status: row.status,
          owner: row.owner,
          ownerExtensionId: row.ownerExtensionId,
          initiator: row.initiator,
          subject: row.subject,
          controls: row.controls,
          progress: row.progress,
          result: row.result,
          createdAt: row.createdAt,
          startedAt: row.startedAt,
          updatedAt: row.updatedAt,
          finishedAt: row.finishedAt
        }
      })
      .run()
  }

  clearCompleted(): void {
    const ids = this.listAll().map((run) => run.id)
    this.db.delete(taskRunHistory).run()
    this.emitDeleted(ids)
  }

  delete(runId: string): void {
    this.db.delete(taskRunHistory).where(eq(taskRunHistory.id, runId)).run()
    this.emitDeleted([runId])
  }

  prune(): void {
    const ids = selectTaskRunHistoryPruneIds(this.listAll())
    if (ids.length === 0) {
      return
    }

    this.deleteMany(ids)
    this.emitDeleted(ids)
  }

  private listAll(): TaskRun[] {
    return this.db.select().from(taskRunHistory).all().map(fromHistoryRow)
  }

  private deleteMany(ids: readonly string[]): void {
    if (ids.length === 1) {
      this.db.delete(taskRunHistory).where(eq(taskRunHistory.id, ids[0])).run()
      return
    }

    this.db
      .delete(taskRunHistory)
      .where(inArray(taskRunHistory.id, [...ids]))
      .run()
  }

  private emitDeleted(ids: readonly string[]): void {
    if (ids.length > 0) {
      this.options.onDeleted?.(ids)
    }
  }
}

function fromHistoryRow(row: TaskRunHistoryRow): TaskRun {
  return {
    id: row.id,
    category: row.category,
    operation: row.operation,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    owner: row.owner,
    initiator: row.initiator,
    subject: row.subject ?? undefined,
    controls: row.controls,
    progress: row.progress ?? undefined,
    result: row.result ?? undefined,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? undefined,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt ?? undefined
  }
}

function toHistoryRow(run: TaskRun): NewTaskRunHistoryRow {
  return {
    id: run.id,
    category: run.category,
    operation: run.operation,
    title: run.title,
    description: run.description ?? null,
    status: run.status as TaskRunFinalStatus,
    owner: run.owner,
    ownerExtensionId: run.owner.type === 'extension' ? run.owner.extension.id : null,
    initiator: run.initiator,
    subject: run.subject ?? null,
    controls: run.controls,
    progress: run.progress ?? null,
    result: run.result ?? null,
    createdAt: run.createdAt,
    startedAt: run.startedAt ?? null,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt ?? null
  }
}

function assertFinalSnapshot(run: TaskRun): void {
  if (!isFinalStatus(run.status)) {
    throw new Error('Task run history only accepts final task runs.')
  }

  if (!run.result || run.result.status !== run.status) {
    throw new Error('Task run final snapshot result status must match run status.')
  }

  if (run.finishedAt === undefined) {
    throw new Error('Task run final snapshot must include finishedAt.')
  }
}

function matchesHistoryQuery(run: TaskRun, query?: TaskRunHistoryListQuery): boolean {
  if (!query) {
    return true
  }

  if (query.statuses?.length && !query.statuses.includes(run.status as TaskRunFinalStatus)) {
    return false
  }

  if (query.categories?.length && !query.categories.includes(run.category)) {
    return false
  }

  if (query.operations?.length && !query.operations.includes(run.operation)) {
    return false
  }

  if (query.ownerTypes?.length && !query.ownerTypes.includes(run.owner.type)) {
    return false
  }

  if (query.initiatorTypes?.length && !query.initiatorTypes.includes(run.initiator.type)) {
    return false
  }

  if (
    query.automationId &&
    (run.initiator.type !== 'automation' || run.initiator.automation.id !== query.automationId)
  ) {
    return false
  }

  if (
    query.extensionId &&
    (run.owner.type !== 'extension' || run.owner.extension.id !== query.extensionId)
  ) {
    return false
  }

  if (query.subject) {
    if (!run.subject || run.subject.type !== query.subject.type) {
      return false
    }

    if (query.subject.id !== undefined && run.subject.id !== query.subject.id) {
      return false
    }
  }

  return true
}

function isFinalStatus(status: string): status is TaskRunFinalStatus {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function applyListLimit<T>(items: T[], limit: number | undefined): T[] {
  if (!Number.isFinite(limit) || limit === undefined || limit <= 0) {
    return items.slice(0, MAX_LIST_LIMIT)
  }

  return items.slice(0, Math.min(Math.floor(limit), MAX_LIST_LIMIT))
}

function assertJsonStorageWithinLimit(value: unknown, label: string): void {
  if (value === null || value === undefined) {
    return
  }

  if (measureJsonBytes(value, label) > MAX_HISTORY_JSON_BYTES) {
    throw new Error(`${label} is too large to store in task run history.`)
  }
}
