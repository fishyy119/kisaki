/**
 * Entity route grammar.
 *
 * Single source of the URL contract of entity detail surfaces: path segments,
 * route patterns, and param names all derive from here, so the route manifest,
 * the data composables, and every page that links to a detail view agree by
 * construction.
 */

import type { AllEntityType } from '@shared/common'

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

/** Route of the list surface that browses one entity type. */
export function getEntityListPath(entityType: AllEntityType): string {
  return `/library/${ENTITY_ROUTE_SEGMENTS[entityType]}`
}

export function getEntityDetailPath(entityType: AllEntityType, id: string): string {
  return `${getEntityListPath(entityType)}/${id}`
}
