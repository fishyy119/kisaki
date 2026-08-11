/**
 * Shared types for composables
 */

import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'
import type { Anime, Game, Character, Person, Company } from '@shared/db'

/** Union type for content entities */
export type ContentEntityData = Game | Anime | Character | Person | Company

/** Entity count by type */
export type ContentEntityCounts = Record<ContentEntityType, number>

export function createEmptyContentEntityCounts(): ContentEntityCounts {
  return Object.fromEntries(CONTENT_ENTITY_TYPES.map((type) => [type, 0])) as ContentEntityCounts
}
