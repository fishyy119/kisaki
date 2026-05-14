/**
 * Database module exports
 */

export { DbService } from './service'
export type { ThumbnailFit, ThumbnailOptions, FileColumns, DbContext } from './types'

// Sub-modules
export { AttachmentStore } from './attachment'
export { ThumbnailStore } from './thumbnail'
export { HelperStore } from './helper'
export { FtsStore } from './fts'
export type { FtsEntityType } from '@shared/db/fts'
