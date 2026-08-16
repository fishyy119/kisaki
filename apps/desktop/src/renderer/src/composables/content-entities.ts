/**
 * Content entity aggregates.
 *
 * Row-type union and per-type counts spanning every content entity, shared by
 * the list surfaces (collection, tag, favorites, uncategorized) that render
 * mixed-entity results.
 */

import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import type { Anime, Game, Character, Movie, Person, Company, Tv } from '@shared/db'

/** Union type for content entities */
export type ContentEntityData = Game | Anime | Tv | Movie | Character | Person | Company

/** Entity count by type */
export type ContentEntityCounts = Record<ContentEntityType, number>

export function createEmptyContentEntityCounts(): ContentEntityCounts {
  return Object.fromEntries(CONTENT_ENTITY_TYPES.map((type) => [type, 0])) as ContentEntityCounts
}
