/**
 * Renderer DB module
 *
 * - `db`: Drizzle sqlite-proxy instance (queries via IPC)
 * - `attachment`: DbService.attachment IPC client
 */

export { db } from './proxy'
export { attachment } from './attachment'
export { previewEntityDelete, deleteEntities } from './entity-delete'
export { mergeEntities } from './entity-merge'
export { ENTITY_TABLES, type EntityRowMap } from './entity-tables'
export {
  COLLECTION_LINKS,
  deleteCollectionLinks,
  insertCollectionLinks,
  queryCollectionMembers,
  type CollectionLinkDef,
  type CollectionLinkRow,
  type CollectionMember
} from './collection-links'
export {
  TAG_LINKS,
  countTaggedEntities,
  queryEntityTagLinks,
  queryTaggedEntities,
  replaceEntityTagLinks,
  type EntityTagLink,
  type TagLinkDef,
  type TagLinkRow
} from './tag-links'
export {
  countEntities,
  queryEntities,
  queryEntityIds,
  queryEntityNames,
  queryEntityRow,
  type EntityQueryOptions
} from './entity-query'
