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
export { ENTITY_TABLES, type EntityRowMap, type EntityTableDef } from './entity-tables'
export { COLLECTION_LINKS, insertCollectionLinks, type CollectionLinkDef } from './collection-links'
export {
  countEntities,
  queryEntities,
  queryEntityIds,
  queryEntityNames,
  type EntityQueryOptions
} from './entity-query'
