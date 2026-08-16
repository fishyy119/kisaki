/**
 * Database module exports
 */

export { DbService } from './service'
export type {
  ThumbnailFit,
  ThumbnailOptions,
  FileColumns,
  FilesColumns,
  DbContext,
  DbQueryContext,
  DbWriteContext
} from './types'

// Sub-modules
export { AttachmentStore } from './attachment'
export { ThumbnailStore } from './thumbnail'
export { DbEntityDeleteHelper, DbEntityFinderHelper } from './helper'
export {
  animeExternalIdLink,
  characterExternalIdLink,
  companyExternalIdLink,
  findExternalIdOwners,
  gameExternalIdLink,
  movieExternalIdLink,
  personExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  tvEpisodeExternalIdLink,
  tvExternalIdLink,
  type ExternalIdLinkTable
} from './helper'
export { SettingsStore } from './settings'
export { FtsStore } from './fts'
export { SqlExecutor, type DbSqlMethod } from './sql'
export type { FtsEntityType } from '@shared/db/contracts/fts'
