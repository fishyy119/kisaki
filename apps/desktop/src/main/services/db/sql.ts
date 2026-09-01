import type Database from 'better-sqlite3'

export type DbSqlMethod = 'run' | 'all' | 'values' | 'get'

/**
 * Prepared statements kept per SQL text. Renderer surfaces repeat the same
 * parametrized statements constantly, so re-preparing per call would pay the
 * SQLite parse/plan cost on every query. SQLite re-prepares cached statements
 * itself when the schema version changes, so the cache never serves stale
 * plans.
 */
const STATEMENT_CACHE_LIMIT = 256

/**
 * Executes renderer-issued SQL over the shared connection.
 *
 * Rows are returned as value arrays in column order (raw mode), which is the
 * shape the drizzle sqlite-proxy driver expects; building object rows first
 * would only allocate per-row garbage to immediately discard.
 */
export class SqlExecutor {
  private readonly statements = new Map<string, Database.Statement>()

  constructor(private readonly sqlite: Database.Database) {}

  execute(sqlstr: string, params: unknown[], method: DbSqlMethod): unknown[] {
    const stmt = this.prepare(sqlstr)

    switch (method) {
      case 'run':
        stmt.run(...params)
        return []
      case 'get':
        return (stmt.raw(true).get(...params) as unknown[] | undefined) ?? []
      case 'all':
      case 'values':
        return stmt.raw(true).all(...params) as unknown[][]
    }
  }

  /** LRU-bounded prepare: a hit refreshes recency, an insert may evict the oldest. */
  private prepare(sqlstr: string): Database.Statement {
    const cached = this.statements.get(sqlstr)
    if (cached) {
      this.statements.delete(sqlstr)
      this.statements.set(sqlstr, cached)
      return cached
    }

    const stmt = this.sqlite.prepare(sqlstr)
    this.statements.set(sqlstr, stmt)

    if (this.statements.size > STATEMENT_CACHE_LIMIT) {
      const oldest = this.statements.keys().next().value
      if (oldest !== undefined) {
        this.statements.delete(oldest)
      }
    }

    return stmt
  }
}
