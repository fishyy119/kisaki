import type { DbService } from '@main/services/db'
import {
  automationRunHistory,
  type AutomationRunHistoryRow,
  type NewAutomationRunHistoryRow
} from '@shared/db'
import type {
  AutomationRunHistoryListQuery,
  AutomationRunHistoryRecord,
  AutomationTrigger
} from '@shared/automation'
import { desc, eq } from 'drizzle-orm'

const DEFAULT_HISTORY_LIMIT = 50
const MAX_HISTORY_LIMIT = 200

export interface AutomationHistoryStoreOptions {
  db: DbService
}

export class AutomationHistoryStore {
  constructor(private readonly options: AutomationHistoryStoreOptions) {}

  list(query: AutomationRunHistoryListQuery = {}): AutomationRunHistoryRecord[] {
    const limit = normalizeLimit(query.limit)
    const rows = query.automationId
      ? this.options.db.client
          .select()
          .from(automationRunHistory)
          .where(eq(automationRunHistory.automationId, query.automationId))
          .orderBy(desc(automationRunHistory.finishedAt))
          .limit(limit)
          .all()
      : this.options.db.client
          .select()
          .from(automationRunHistory)
          .orderBy(desc(automationRunHistory.finishedAt))
          .limit(limit)
          .all()

    return rows.map(fromHistoryRow).filter((record) => matchesQuery(record, query))
  }

  insert(record: AutomationRunHistoryRecord): void {
    this.options.db.client.insert(automationRunHistory).values(toHistoryRow(record)).run()
  }

  deleteForAutomation(automationId: string): void {
    this.options.db.client
      .delete(automationRunHistory)
      .where(eq(automationRunHistory.automationId, automationId))
      .run()
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_HISTORY_LIMIT
  }

  if (!Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT
  }

  return Math.max(1, Math.min(Math.trunc(limit), MAX_HISTORY_LIMIT))
}

function matchesQuery(
  record: AutomationRunHistoryRecord,
  query: AutomationRunHistoryListQuery
): boolean {
  if (query.ownerTypes && !query.ownerTypes.includes(record.owner.type)) {
    return false
  }

  if (
    query.extensionId &&
    (record.owner.type !== 'extension' || record.owner.extension.id !== query.extensionId)
  ) {
    return false
  }

  if (query.commandIds && !query.commandIds.includes(record.commandId)) {
    return false
  }

  if (query.triggers && !query.triggers.includes(record.trigger)) {
    return false
  }

  if (query.invocationStatuses && !query.invocationStatuses.includes(record.invocationStatus)) {
    return false
  }

  return true
}

function fromHistoryRow(row: AutomationRunHistoryRow): AutomationRunHistoryRecord {
  return {
    id: row.id,
    automationId: row.automationId,
    automationNameSnapshot: row.automationNameSnapshot,
    owner: row.owner,
    trigger: row.trigger as AutomationTrigger,
    attempt: row.attempt,
    commandId: row.commandId,
    commandTitleSnapshot: row.commandTitleSnapshot ?? undefined,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    invocationStatus: row.invocationStatus,
    error: row.error ?? undefined
  }
}

function toHistoryRow(record: AutomationRunHistoryRecord): NewAutomationRunHistoryRow {
  return {
    id: record.id,
    automationId: record.automationId,
    automationNameSnapshot: record.automationNameSnapshot,
    owner: record.owner,
    ownerExtensionId: record.owner.type === 'extension' ? record.owner.extension.id : null,
    trigger: record.trigger,
    attempt: record.attempt,
    commandId: record.commandId,
    commandTitleSnapshot: record.commandTitleSnapshot ?? null,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    invocationStatus: record.invocationStatus,
    error: record.error ?? null
  }
}
