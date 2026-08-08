/**
 * SQLite change capture.
 *
 * Row-level insert/update/delete changes are captured by AFTER triggers that
 * append to a transactional outbox, and are only delivered to the change feed
 * once no transaction is open. A rolled back transaction discards its outbox
 * rows with the rest of its writes, so consumers never observe changes that
 * were undone.
 *
 * Triggers and the outbox are TEMP objects: they belong to this connection,
 * never persist, and are rebuilt on every start. Tracked tables come from the
 * Drizzle schema.
 */

import type Database from 'better-sqlite3'
import { getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { createLogger } from '@main/log'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import type { RawDbChange, RawDbChangeOperation } from '@shared/db/changes'

const log = createLogger('Db')

const OUTBOX_TABLE = 'db_change_outbox'

/** Epoch milliseconds, matching `Date.now()` precision. */
const OCCURRED_AT_MS = `CAST((julianday('now') - 2440587.5) * 86400000.0 AS INTEGER)`

/** Delay before re-checking an open transaction, so drains never spin. */
const DRAIN_RETRY_MS = 10

interface OutboxRow {
  seq: number
  operation: string
  table_name: string
  row_id: string
  old_json: string | null
  next_json: string | null
  occurred_at: number
}

/**
 * Extract all table names from Drizzle schema.
 * This iterates over all exports and finds SQLiteTable instances.
 */
function getTrackedTables(): string[] {
  const tables: string[] = []
  for (const value of Object.values(schema)) {
    if (is(value, SQLiteTable)) {
      tables.push(getTableName(value))
    }
  }
  return tables
}

/**
 * Drops every persisted trigger in the database.
 *
 * Must run before schema migrations. Persisted triggers are runtime-owned (FTS
 * sync, plus change triggers left by older versions that persisted them), and
 * their bodies snapshot table columns. Dropping them first keeps ALTER TABLE
 * migrations from failing on trigger column references.
 */
export function dropAllTriggers(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .all() as Array<{ name: string }>
  for (const row of rows) {
    sqlite.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(row.name)}`)
  }
}

export class TriggerStore {
  private readonly trackedTables: string[]
  private drainScheduled = false
  private retryTimer: NodeJS.Timeout | null = null
  private disposed = false

  constructor(
    private readonly sqlite: Database.Database,
    private readonly sink: (change: RawDbChange) => void
  ) {
    this.trackedTables = getTrackedTables()
  }

  init(): void {
    this.createOutbox()
    this.registerSignalFunction()
    this.createTriggers()
    log.info('Initialized with triggers for', this.trackedTables.length, 'tables')
  }

  /**
   * Delivers every committed outbox change to the sink.
   *
   * Called automatically after write statements settle; call directly to flush
   * before closing the connection. Does nothing while a transaction is open,
   * because those changes may still roll back.
   */
  drain(): void {
    if (this.disposed || this.sqlite.inTransaction) {
      return
    }

    let rows: OutboxRow[]
    try {
      rows = this.sqlite
        .prepare(`SELECT * FROM ${quoteIdentifier(OUTBOX_TABLE)} ORDER BY "seq"`)
        .all() as OutboxRow[]
    } catch (error) {
      log.error('Failed to read change outbox.', error)
      return
    }

    if (rows.length === 0) {
      return
    }

    // Consume before dispatching: sink listeners may write to the database and
    // append new outbox rows, which must not be redelivered with this batch.
    this.sqlite
      .prepare(`DELETE FROM ${quoteIdentifier(OUTBOX_TABLE)} WHERE "seq" <= ?`)
      .run(rows[rows.length - 1].seq)

    for (const row of rows) {
      this.sink(toRawChange(row))
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private createOutbox(): void {
    this.sqlite.exec(`
      CREATE TEMP TABLE IF NOT EXISTS ${quoteIdentifier(OUTBOX_TABLE)} (
        "seq" INTEGER PRIMARY KEY AUTOINCREMENT,
        "operation" TEXT NOT NULL,
        "table_name" TEXT NOT NULL,
        "row_id" TEXT NOT NULL,
        "old_json" TEXT,
        "next_json" TEXT,
        "occurred_at" INTEGER NOT NULL
      )
    `)
  }

  /**
   * Register the signal triggers call after appending to the outbox.
   * Delivery is deferred so consumers never re-enter a busy connection, and so
   * changes stay unpublished until their transaction commits.
   */
  private registerSignalFunction(): void {
    this.sqlite.function('emit_db_change_signal', { deterministic: false }, () => {
      this.scheduleDrain()
      return null
    })
  }

  private scheduleDrain(): void {
    if (this.drainScheduled || this.disposed) {
      return
    }
    this.drainScheduled = true
    queueMicrotask(() => this.runScheduledDrain())
  }

  private runScheduledDrain(): void {
    this.drainScheduled = false
    if (this.disposed) {
      return
    }

    if (this.sqlite.inTransaction) {
      this.retryDrainLater()
      return
    }

    try {
      this.drain()
    } catch (error) {
      log.error('Failed to drain change outbox.', error)
    }
  }

  private retryDrainLater(): void {
    if (this.retryTimer) {
      return
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.scheduleDrain()
    }, DRAIN_RETRY_MS)
  }

  /**
   * Create INSERT/UPDATE/DELETE triggers for all tracked tables.
   */
  private createTriggers(): void {
    for (const table of this.trackedTables) {
      this.createTriggersForTable(table)
    }
  }

  /**
   * Create all three triggers for a specific table.
   */
  private createTriggersForTable(table: string): void {
    const columns = this.getTableColumns(table)
    const oldSnapshot = createRowSnapshotExpression('OLD', columns)
    const nextSnapshot = createRowSnapshotExpression('NEW', columns)

    this.createTrigger(table, 'INSERT', 'inserted', 'NEW', 'NULL', nextSnapshot)
    this.createTrigger(table, 'UPDATE', 'updated', 'NEW', oldSnapshot, nextSnapshot)
    this.createTrigger(table, 'DELETE', 'deleted', 'OLD', oldSnapshot, 'NULL')
  }

  private createTrigger(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    operation: RawDbChangeOperation,
    alias: 'OLD' | 'NEW',
    oldExpression: string,
    nextExpression: string
  ): void {
    const name = quoteIdentifier(`${table}_after_${event.toLowerCase()}`)

    this.sqlite.exec(`DROP TRIGGER IF EXISTS ${name}`)
    this.sqlite.exec(`
      CREATE TEMP TRIGGER ${name} AFTER ${event} ON main.${quoteIdentifier(table)}
      BEGIN
        INSERT INTO ${quoteIdentifier(OUTBOX_TABLE)}
          ("operation", "table_name", "row_id", "old_json", "next_json", "occurred_at")
        VALUES (
          ${quoteString(operation)},
          ${quoteString(table)},
          ${alias}."id",
          ${oldExpression},
          ${nextExpression},
          ${OCCURRED_AT_MS}
        );
        SELECT emit_db_change_signal();
      END
    `)
  }

  private getTableColumns(table: string): string[] {
    const rows = this.sqlite
      .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
      .all() as Array<{
      name?: unknown
    }>
    const columns = rows.map((row) => String(row.name)).filter(Boolean)
    if (!columns.includes('id')) {
      throw new Error(`Tracked table "${table}" must have an id column.`)
    }
    return columns
  }
}

function createRowSnapshotExpression(alias: 'OLD' | 'NEW', columns: string[]): string {
  const args = columns
    .map((column) => `${quoteString(column)}, ${alias}.${quoteIdentifier(column)}`)
    .join(', ')
  return `json_object(${args})`
}

function toRawChange(row: OutboxRow): RawDbChange {
  return {
    operation: normalizeOperation(row.operation),
    table: row.table_name as TableName,
    id: String(row.row_id),
    old: parseRowSnapshot(row.old_json),
    next: parseRowSnapshot(row.next_json),
    occurredAt: row.occurred_at
  }
}

function normalizeOperation(value: unknown): RawDbChangeOperation {
  if (value === 'inserted' || value === 'updated' || value === 'deleted') {
    return value
  }
  throw new Error(`Unknown DB change operation: ${String(value)}`)
}

function parseRowSnapshot(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch (error) {
    log.warn('Failed to parse row snapshot:', error)
    return undefined
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
