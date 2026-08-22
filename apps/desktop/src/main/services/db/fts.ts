/**
 * FTS Store
 *
 * Manages FTS5 virtual tables for full-text search.
 * Handles initialization, synchronization triggers, and rebuild operations.
 *
 * Design:
 * - Uses SQLite FTS5 with content table mode (no data duplication)
 * - SQLite triggers automatically sync data changes
 * - unicode61 tokenizer for CJK character support
 *
 * Search indexes are derived state, not schema: `FTS_TABLES` below is the only
 * truth about which indexes exist and which columns they carry, and `init`
 * makes the database match it — a table whose columns differ is rebuilt from
 * its source, and an index no entity type declares is dropped. Migrations
 * therefore never touch FTS objects, and any drift resolves on the next start.
 */

import type Database from 'better-sqlite3'
import { createLogger } from '@main/log'
import type { FtsEntityType } from '@shared/db/contracts/fts'

const log = createLogger('Db')

// =============================================================================
// Types
// =============================================================================

/** FTS table configuration */
interface FtsTableConfig {
  /** Source table name */
  tableName: string
  /** FTS virtual table name */
  ftsTableName: string
  /** Columns to index (must match source table column names) */
  columns: string[]
}

// =============================================================================
// Configuration
// =============================================================================

/** FTS table definitions for each entity type */
const FTS_TABLES: Record<FtsEntityType, FtsTableConfig> = {
  game: {
    tableName: 'games',
    ftsTableName: 'games_fts',
    columns: ['name', 'original_name', 'sort_name', 'aliases', 'description']
  },
  anime: {
    tableName: 'animes',
    ftsTableName: 'animes_fts',
    columns: ['name', 'original_name', 'sort_name', 'aliases', 'description']
  },
  character: {
    tableName: 'characters',
    ftsTableName: 'characters_fts',
    columns: ['name', 'original_name', 'sort_name', 'aliases', 'description']
  },
  person: {
    tableName: 'persons',
    ftsTableName: 'persons_fts',
    columns: ['name', 'original_name', 'sort_name', 'aliases', 'description']
  },
  company: {
    tableName: 'companies',
    ftsTableName: 'companies_fts',
    columns: ['name', 'original_name', 'sort_name', 'description']
  }
}

// =============================================================================
// FtsStore
// =============================================================================

export class FtsStore {
  constructor(private sqlite: Database.Database) {}

  // ==================== Public API ====================

  /**
   * Initialize FTS tables and triggers
   * Called during DbService.init()
   */
  init(): void {
    for (const [entityType, config] of Object.entries(FTS_TABLES)) {
      const wasCreated = this.reconcileFtsTable(config)
      this.createTriggers(config)

      // Populate FTS with existing data if table was just created
      // FTS5 content tables don't auto-sync existing rows
      if (wasCreated) {
        this.populateFromSource(config)
        log.info('Populated FTS index.', { entityType: entityType })
      }
    }
    this.dropUndeclaredFtsTables()
    log.info('FTS5 tables initialized')
  }

  /**
   * Rebuild FTS index for a specific entity type
   * Use for recovery or after bulk imports
   */
  rebuild(entityType: FtsEntityType): void {
    const config = FTS_TABLES[entityType]
    if (!config) throw new Error(`Unknown entity type: ${entityType}`)

    const { tableName, ftsTableName, columns } = config
    const columnList = columns.join(', ')

    // Use transaction for atomicity
    this.sqlite.transaction(() => {
      // Delete all FTS content using special 'delete-all' command
      this.sqlite.exec(`INSERT INTO ${ftsTableName}(${ftsTableName}) VALUES('delete-all')`)

      // Repopulate from source table
      this.sqlite.exec(`
        INSERT INTO ${ftsTableName}(rowid, ${columnList})
        SELECT rowid, ${columnList} FROM ${tableName}
      `)
    })()

    log.info('Rebuilt FTS index.', { entityType: entityType })
  }

  /**
   * Rebuild all FTS indexes
   */
  rebuildAll(): void {
    for (const entityType of Object.keys(FTS_TABLES) as FtsEntityType[]) {
      this.rebuild(entityType)
    }
    log.info('All FTS indexes rebuilt')
  }

  /**
   * Check if FTS is available for an entity type
   */
  isSupported(entityType: string): entityType is FtsEntityType {
    return entityType in FTS_TABLES
  }

  /**
   * Get FTS table name for an entity type
   */
  getFtsTableName(entityType: FtsEntityType): string {
    return FTS_TABLES[entityType].ftsTableName
  }

  /**
   * Get source table name for an entity type
   */
  getSourceTableName(entityType: FtsEntityType): string {
    return FTS_TABLES[entityType].tableName
  }

  // ==================== Private Methods ====================

  /**
   * Bring one FTS table in line with its declared columns.
   *
   * An index whose columns no longer match the declaration is dropped and
   * recreated rather than altered: FTS5 cannot add a column, and the index
   * holds no truth of its own that a rebuild from the source could lose.
   * @returns true when the table was created and still needs its rows.
   */
  private reconcileFtsTable(config: FtsTableConfig): boolean {
    const { ftsTableName, columns } = config
    const currentColumns = this.readTableColumns(ftsTableName)

    if (currentColumns.length > 0) {
      if (currentColumns.join(', ') === columns.join(', ')) {
        return false
      }

      this.sqlite.exec(`DROP TABLE ${ftsTableName}`)
      log.info('Dropped FTS index with outdated columns.', { ftsTableName: ftsTableName })
    }

    this.createFtsTable(config)
    return true
  }

  private createFtsTable(config: FtsTableConfig): void {
    const { tableName, ftsTableName, columns } = config
    const columnList = columns.join(', ')

    // Create FTS5 virtual table with content sync
    // - content: points to source table for contentless FTS
    // - content_rowid: use source table's rowid for syncing
    // - tokenize: unicode61 handles CJK characters well
    // - remove_diacritics: normalize accented characters
    this.sqlite.exec(`
      CREATE VIRTUAL TABLE ${ftsTableName} USING fts5(
        ${columnList},
        content='${tableName}',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      )
    `)
  }

  /** Column names of a table, or an empty list when it does not exist. */
  private readTableColumns(tableName: string): string[] {
    const rows = this.sqlite
      .prepare('SELECT name FROM pragma_table_info(?)')
      .all(tableName) as Array<{ name: string }>

    return rows.map((row) => row.name)
  }

  /**
   * Drops search indexes no entity type declares any more.
   *
   * Their source tables are long gone with the entity types they served, so
   * the indexes would otherwise sit in the database forever: nothing writes to
   * them and no rebuild reaches them. FTS5 shadow tables are named after their
   * index and disappear with it.
   */
  private dropUndeclaredFtsTables(): void {
    const declared = new Set(Object.values(FTS_TABLES).map((config) => config.ftsTableName))
    const rows = this.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%\\_fts' ESCAPE '\\'"
      )
      .all() as Array<{ name: string }>

    for (const { name } of rows) {
      if (declared.has(name)) continue

      this.sqlite.exec(`DROP TABLE ${name}`)
      log.info('Dropped undeclared FTS index.', { ftsTableName: name })
    }
  }

  /**
   * Populate FTS table with existing data from source table
   * Called after creating a new FTS table
   */
  private populateFromSource(config: FtsTableConfig): void {
    const { tableName, ftsTableName, columns } = config
    const columnList = columns.join(', ')

    this.sqlite.exec(`
      INSERT INTO ${ftsTableName}(rowid, ${columnList})
      SELECT rowid, ${columnList} FROM ${tableName}
    `)
  }

  private createTriggers(config: FtsTableConfig): void {
    const { tableName, ftsTableName, columns } = config
    const columnList = columns.join(', ')
    const newValues = columns.map((c) => `NEW.${c}`).join(', ')
    const oldValues = columns.map((c) => `OLD.${c}`).join(', ')

    // Insert trigger: add new row to FTS
    this.sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${ftsTableName}_insert
      AFTER INSERT ON ${tableName} BEGIN
        INSERT INTO ${ftsTableName}(rowid, ${columnList})
        VALUES (NEW.rowid, ${newValues});
      END
    `)

    // Update trigger: delete old, insert new
    // FTS5 requires special 'delete' command for content tables
    this.sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${ftsTableName}_update
      AFTER UPDATE ON ${tableName} BEGIN
        INSERT INTO ${ftsTableName}(${ftsTableName}, rowid, ${columnList})
        VALUES ('delete', OLD.rowid, ${oldValues});
        INSERT INTO ${ftsTableName}(rowid, ${columnList})
        VALUES (NEW.rowid, ${newValues});
      END
    `)

    // Delete trigger: remove from FTS
    this.sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${ftsTableName}_delete
      AFTER DELETE ON ${tableName} BEGIN
        INSERT INTO ${ftsTableName}(${ftsTableName}, rowid, ${columnList})
        VALUES ('delete', OLD.rowid, ${oldValues});
      END
    `)
  }
}
