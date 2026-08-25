/**
 * Public surface of the data platform service.
 *
 * Only what other services actually consume: the service itself, the context
 * types they thread through their own transactions, and the entity-graph
 * primitives ingest composes with.
 */

export { DbService } from './service'
export type { DbCuration } from './service'
export type { DbContext, DbQueryContext, DbWriteContext } from './types'
export { AttachmentStore } from './attachment'
export {
  animeExternalIdLink,
  characterExternalIdLink,
  comicExternalIdLink,
  companyExternalIdLink,
  findExternalIdOwners,
  gameExternalIdLink,
  novelExternalIdLink,
  personExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type ExternalIdLinkTable
} from './helper'
