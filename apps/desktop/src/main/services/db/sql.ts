import type Database from 'better-sqlite3'

export type DbSqlMethod = 'run' | 'all' | 'values' | 'get'

export class SqlExecutor {
  constructor(private readonly sqlite: Database.Database) {}

  execute(sqlstr: string, params: unknown[], method: DbSqlMethod): unknown[] {
    const stmt = this.sqlite.prepare(sqlstr)

    switch (method) {
      case 'run':
        stmt.run(...params)
        return []
      case 'get':
        return this.toRow(stmt.get(...params), stmt)
      case 'all':
        return this.toRows(stmt.all(...params), stmt)
      case 'values':
        return stmt.raw().all(...params) as unknown[][]
    }
  }

  private toRow(row: unknown, stmt: Database.Statement): unknown[] {
    if (!isRecord(row)) return []

    return this.getColumnNames(stmt).map((column) => row[column])
  }

  private toRows(rows: unknown[], stmt: Database.Statement): unknown[][] {
    if (rows.length === 0) return []

    const columns = this.getColumnNames(stmt)
    return rows.map((row) => {
      if (!isRecord(row)) return []
      return columns.map((column) => row[column])
    })
  }

  private getColumnNames(stmt: Database.Statement): string[] {
    return stmt.columns().map((column) => column.name)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
