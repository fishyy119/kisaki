/**
 * Entity route grammar.
 *
 * Single source of the URL contract of entity detail surfaces: path segments,
 * route patterns, param names, and route names all derive from here, so the
 * route manifest, the data composables, and every page that links to a detail
 * view agree by construction.
 */

import type { RouteLocationNormalizedGeneric } from 'vue-router'
import {
  CONTENT_ENTITY_TYPES,
  type AllEntityType,
  type ContentEntityType
} from '@shared/entity-types'

export const LIBRARY_HOME_PATH = '/library'

const ENTITY_ROUTE_SEGMENTS: Record<AllEntityType, string> = {
  game: 'game',
  anime: 'anime',
  comic: 'comic',
  novel: 'novel',
  character: 'character',
  person: 'person',
  company: 'company',
  collection: 'collection',
  tag: 'tag'
}

/** Route param carrying the entity id on its detail route. */
export function entityRouteParam<T extends AllEntityType>(entityType: T): `${T}Id` {
  return `${entityType}Id`
}

/** Relative detail-route pattern under the library layout, e.g. `game/:gameId`. */
export function getEntityDetailRoutePattern(entityType: AllEntityType): string {
  return `${ENTITY_ROUTE_SEGMENTS[entityType]}/:${entityRouteParam(entityType)}`
}

/** Route name of an entity type's detail route. */
export function entityDetailRouteName(entityType: AllEntityType): string {
  return `${entityType}-detail`
}

/** Route of the list surface that browses one entity type. */
export function getEntityListPath(entityType: AllEntityType): string {
  return `${LIBRARY_HOME_PATH}/${ENTITY_ROUTE_SEGMENTS[entityType]}`
}

export function getEntityDetailPath(entityType: AllEntityType, id: string): string {
  return `${getEntityListPath(entityType)}/${id}`
}

// =============================================================================
// Route matching
// =============================================================================

const DETAIL_ROUTE_CONTENT_TYPES = new Map<string, ContentEntityType>(
  CONTENT_ENTITY_TYPES.map((entityType) => [entityDetailRouteName(entityType), entityType])
)

/** Content entity a detail route shows. */
export interface ContentEntityDetailRouteMatch {
  entityType: ContentEntityType
  entityId: string
}

/**
 * The content entity a route shows, or null off content detail routes.
 *
 * Organizer detail routes (collection, tag) never match: they are containers,
 * not content carrying a browse context.
 */
export function matchContentEntityDetailRoute(
  route: RouteLocationNormalizedGeneric
): ContentEntityDetailRouteMatch | null {
  const entityType =
    typeof route.name === 'string' ? DETAIL_ROUTE_CONTENT_TYPES.get(route.name) : undefined
  if (!entityType) return null

  const entityId = route.params[entityRouteParam(entityType)]
  if (typeof entityId !== 'string' || entityId === '') return null

  return { entityType, entityId }
}
