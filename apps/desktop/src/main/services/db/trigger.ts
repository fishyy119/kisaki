/**
 * SQLite Trigger Store
 *
 * Captures row-level insert/update/delete changes via SQLite AFTER triggers
 * and feeds them into the db change feed. Uses better-sqlite3's custom
 * function registration to bridge SQL triggers with JavaScript.
 *
 * Table names are automatically inferred from the Drizzle schema.
 */

import type Database from 'better-sqlite3'
import { getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { createLogger } from '@main/log'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import type { RawDbChange, RawDbChangeOperation } from '@shared/db/changes'

const log = createLogger('Db')

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

export class TriggerStore {
  private trackedTables: string[]

  constructor(
    private sqlite: Database.Database,
    private sink: (change: RawDbChange) => void
  ) {
    this.trackedTables = getTrackedTables()
  }

  init(): void {
    this.registerEmitFunction()
    this.createTriggers()
    log.info('Initialized with triggers for', this.trackedTables.length, 'tables')
  }

  /**
   * Register the emit_db_change function that triggers can call.
   * This bridges SQLite triggers with the JavaScript change feed.
   */
  private registerEmitFunction(): void {
    this.sqlite.function(
      'emit_db_change',
      { deterministic: false },
      (operation, table, id, oldJson, nextJson) => {
        const change = this.createRawChange(operation, table, id, oldJson, nextJson)

        // Defer delivery until the current SQL statement completes.
        // This prevents "connection is busy" errors when consumers access the DB.
        queueMicrotask(() => {
          this.sink(change)
        })
      }
    )
  }

  private createRawChange(
    operation: unknown,
    table: unknown,
    id: unknown,
    oldJson: unknown,
    nextJson: unknown
  ): RawDbChange {
    return {
      operation: normalizeOperation(operation),
      table: table as TableName,
      id: String(id),
      old: parseRowSnapshot(oldJson),
      next: parseRowSnapshot(nextJson),
      occurredAt: Date.now()
    }
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
    const idColumn = 'id'
    const columns = this.getTableColumns(table)
    const oldSnapshot = this.createRowSnapshotExpression('OLD', columns)
    const nextSnapshot = this.createRowSnapshotExpression('NEW', columns)

    // Drop existing triggers first (for idempotent initialization)
    this.sqlite.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(`${table}_after_insert`)}`)
    this.sqlite.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(`${table}_after_update`)}`)
    this.sqlite.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(`${table}_after_delete`)}`)

    // Create AFTER INSERT trigger
    this.sqlite.exec(`
      CREATE TRIGGER ${quoteIdentifier(`${table}_after_insert`)} AFTER INSERT ON ${quoteIdentifier(table)}
      BEGIN
        SELECT emit_db_change('inserted', '${table}', NEW.${quoteIdentifier(idColumn)}, NULL, ${nextSnapshot});
      END
    `)

    // Create AFTER UPDATE trigger
    this.sqlite.exec(`
      CREATE TRIGGER ${quoteIdentifier(`${table}_after_update`)} AFTER UPDATE ON ${quoteIdentifier(table)}
      BEGIN
        SELECT emit_db_change('updated', '${table}', NEW.${quoteIdentifier(idColumn)}, ${oldSnapshot}, ${nextSnapshot});
      END
    `)

    // Create AFTER DELETE trigger
    this.sqlite.exec(`
      CREATE TRIGGER ${quoteIdentifier(`${table}_after_delete`)} AFTER DELETE ON ${quoteIdentifier(table)}
      BEGIN
        SELECT emit_db_change('deleted', '${table}', OLD.${quoteIdentifier(idColumn)}, ${oldSnapshot}, NULL);
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

  private createRowSnapshotExpression(alias: 'OLD' | 'NEW', columns: string[]): string {
    const args = columns
      .map((column) => `${quoteString(column)}, ${alias}.${quoteIdentifier(column)}`)
      .join(', ')
    return `json_object(${args})`
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
