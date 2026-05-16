/**
 * Database module exports
 */

export { DbService } from './service'
export type { ThumbnailFit, ThumbnailOptions, FileColumns, FilesColumns, DbContext } from './types'

// Sub-modules
export { AttachmentStore } from './attachment'
export { ThumbnailStore } from './thumbnail'
export { DbEntityDeleteHelper, DbEntityFinderHelper } from './helper'
export { FtsStore } from './fts'
export { SqlExecutor, type DbSqlMethod } from './sql'
export type { FtsEntityType } from '@shared/db/fts'
