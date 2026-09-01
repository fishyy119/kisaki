/**
 * Explorer browse context.
 *
 * The browse contexts the library explorer can address: collection groups and
 * the uncategorized group. Content detail routes carry a `from` query naming
 * one of these contexts — an explorer instance address, never a provenance
 * record — so the explorer can highlight and reveal the exact row the entity
 * was opened from. This module owns the token grammar and the route each
 * context browses, so no caller re-spells either.
 *
 * Surfaces without an explorer address (tag, favorites, search, statistics)
 * navigate without `from`; the autofill guard fills in the canonical
 * default-from, so a well-formed URL always carries an addressable context.
 */

import type { ContentEntityType } from '@shared/common'
import { getEntityDetailPath, LIBRARY_HOME_PATH } from './entity-routes'

/** Browse contexts the explorer can address. */
export type ExplorerContext =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'uncategorized' }

/** Token to store in a detail route's `from` query. */
export function formatExplorerContext(context: ExplorerContext): string {
  switch (context.kind) {
    case 'collection':
      return `collection:${context.collectionId}`
    case 'uncategorized':
      return 'uncategorized'
  }
}

/**
 * Route of the surface a context browses. The uncategorized surface exists per
 * content entity type, so it needs the type being browsed.
 */
export function getExplorerContextPath(
  context: ExplorerContext,
  entityType: ContentEntityType
): string {
  switch (context.kind) {
    case 'collection':
      return getEntityDetailPath('collection', context.collectionId)
    case 'uncategorized':
      return `${LIBRARY_HOME_PATH}/uncategorized/${entityType}`
  }
}
