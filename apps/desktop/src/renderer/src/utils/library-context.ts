/**
 * Library browse context.
 *
 * Detail routes carry a `from` query naming the surface the entity was opened
 * from, so the explorer can highlight that surface. The token is a context name,
 * never a path: this module owns the grammar and the route each context browses,
 * so no caller re-spells either.
 */

import type { ContentEntityType } from '@shared/common'
import { getEntityDetailPath } from './entity-routes'

/** Library surfaces that browse entities. */
export type LibraryContext =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'tag'; tagId: string }
  | { kind: 'uncategorized' }
  | { kind: 'favorites' }

export const LIBRARY_HOME_PATH = '/library'

/** Token to store in a detail route's `from` query. */
export function formatLibraryContext(context: LibraryContext): string {
  switch (context.kind) {
    case 'collection':
      return `collection:${context.collectionId}`
    case 'tag':
      return `tag:${context.tagId}`
    case 'uncategorized':
      return 'uncategorized'
    case 'favorites':
      return 'favorites'
  }
}

/**
 * Route of the surface a context browses. The uncategorized surface exists per
 * content entity type, so it needs the type being browsed.
 */
export function getLibraryContextPath(
  context: LibraryContext,
  entityType: ContentEntityType
): string {
  switch (context.kind) {
    case 'collection':
      return getEntityDetailPath('collection', context.collectionId)
    case 'tag':
      return getEntityDetailPath('tag', context.tagId)
    case 'uncategorized':
      return `${LIBRARY_HOME_PATH}/uncategorized/${entityType}`
    case 'favorites':
      return `${LIBRARY_HOME_PATH}/favorites`
  }
}
