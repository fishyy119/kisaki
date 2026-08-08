/**
 * Database Service Types
 *
 * Shared type definitions for database service modules.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { SQLiteTable, SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import type * as schema from '@shared/db/schema'

/** Extract column names from Drizzle table type */
export type ExtractColumns<T> =
  T extends SQLiteTable<infer Config> ? keyof Config['columns'] : never

/** Filter fields ending with 'File' */
export type FileColumns<T> = Extract<ExtractColumns<T>, `${string}File`>

/** Filter fields ending with 'Files' */
export type FilesColumns<T> = Extract<ExtractColumns<T>, `${string}Files`>

/** Thumbnail fit mode */
export type ThumbnailFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'smart'

/** Thumbnail size options */
export interface ThumbnailOptions {
  width?: number
  height?: number
  fit?: ThumbnailFit
  quality?: number
}

/**
 * Database context - either a database connection or a transaction.
 * Used for functions that can work within an existing transaction.
 */
export type DbContext =
  | BetterSQLite3Database<typeof schema>
  | SQLiteTransaction<'sync', any, typeof schema, ExtractTablesWithRelations<typeof schema>>

/**
 * Read-only view of a `DbContext`.
 *
 * The union above hides `select`'s overloads, so helpers that build queries from
 * runtime table references narrow to this shape first. Connection and
 * transaction share the same query surface, so the narrowing is structural.
 */
export type DbQueryContext = Pick<BetterSQLite3Database<typeof schema>, 'select'>

/**
 * Write view of a `DbContext`, for helpers that write through runtime table
 * references. Same structural narrowing rationale as `DbQueryContext`.
 */
export type DbWriteContext = Pick<
  BetterSQLite3Database<typeof schema>,
  'insert' | 'update' | 'delete'
>
