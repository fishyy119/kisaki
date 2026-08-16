/**
 * Entity route registry.
 *
 * Single place that maps an entity type to its library routes, so adding a
 * media type does not require editing every page that links to a detail view.
 */

import type { AllEntityType } from '@shared/common'

const ENTITY_ROUTE_SEGMENTS: Record<AllEntityType, string> = {
  game: 'game',
  anime: 'anime',
  tv: 'tv',
  movie: 'movie',
  character: 'character',
  person: 'person',
  company: 'company',
  collection: 'collection',
  tag: 'tag'
}

/** Route of the list surface that browses one entity type. */
export function getEntityListPath(entityType: AllEntityType): string {
  return `/library/${ENTITY_ROUTE_SEGMENTS[entityType]}`
}

export function getEntityDetailPath(entityType: AllEntityType, id: string): string {
  return `${getEntityListPath(entityType)}/${id}`
}
