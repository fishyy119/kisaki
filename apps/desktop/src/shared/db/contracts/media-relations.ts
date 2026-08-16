/**
 * Media relation vocabulary.
 *
 * Media relations are directed edges between media entries stored in the
 * polymorphic `media_relations` table. Rows are stored exactly as written
 * (scrape or edit); readers merge both directions, labelling incoming edges
 * through the total inverse map, so a half-written pair stays visible from
 * both endpoints.
 */

import type { MediaType } from '../../common'

export const MEDIA_RELATION_TYPES = [
  'sequel',
  'prequel',
  'sideStory',
  'parentStory',
  'summary',
  'fullStory',
  'adaptation',
  'sourceMaterial',
  'alternative',
  'other'
] as const

export type MediaRelationType = (typeof MEDIA_RELATION_TYPES)[number]

/** Label used when an edge is read from its target side; total by construction. */
export const MEDIA_RELATION_TYPE_INVERSE: Record<MediaRelationType, MediaRelationType> = {
  sequel: 'prequel',
  prequel: 'sequel',
  sideStory: 'parentStory',
  parentStory: 'sideStory',
  summary: 'fullStory',
  fullStory: 'summary',
  adaptation: 'sourceMaterial',
  sourceMaterial: 'adaptation',
  alternative: 'alternative',
  other: 'other'
}

export type MediaTypePair = `${MediaType}-${MediaType}`

const SAME_TYPE_RELATION_TYPES: readonly MediaRelationType[] = [
  'sequel',
  'prequel',
  'sideStory',
  'parentStory',
  'summary',
  'fullStory',
  'alternative',
  'other'
]

const CROSS_TYPE_RELATION_TYPES: readonly MediaRelationType[] = [
  'adaptation',
  'sourceMaterial',
  'other'
]

/**
 * Allowed relation types per ordered endpoint pair. Same-type pairs carry the
 * structural vocabulary (sequels, summaries, versions); cross-type pairs carry
 * provenance only. Adding a media type forces entries here at compile time.
 *
 * Which structures that vocabulary expresses follows entry grain: anime seasons
 * and film series are separate entries joined by these edges, while tv seasons
 * live inside the show entry, so tv edges connect distinct shows — spin-offs,
 * remakes, and the occasional prequel series.
 */
export const MEDIA_RELATION_TYPE_RULES: Record<MediaTypePair, readonly MediaRelationType[]> = {
  'game-game': SAME_TYPE_RELATION_TYPES,
  'anime-anime': SAME_TYPE_RELATION_TYPES,
  'tv-tv': SAME_TYPE_RELATION_TYPES,
  'movie-movie': SAME_TYPE_RELATION_TYPES,
  'game-anime': CROSS_TYPE_RELATION_TYPES,
  'game-tv': CROSS_TYPE_RELATION_TYPES,
  'game-movie': CROSS_TYPE_RELATION_TYPES,
  'anime-game': CROSS_TYPE_RELATION_TYPES,
  'anime-tv': CROSS_TYPE_RELATION_TYPES,
  'anime-movie': CROSS_TYPE_RELATION_TYPES,
  'tv-game': CROSS_TYPE_RELATION_TYPES,
  'tv-anime': CROSS_TYPE_RELATION_TYPES,
  'tv-movie': CROSS_TYPE_RELATION_TYPES,
  'movie-game': CROSS_TYPE_RELATION_TYPES,
  'movie-anime': CROSS_TYPE_RELATION_TYPES,
  'movie-tv': CROSS_TYPE_RELATION_TYPES
}

/** Allowed relation types for a directed edge from `fromType` to `toType`. */
export function getMediaRelationTypeRules(
  fromType: MediaType,
  toType: MediaType
): readonly MediaRelationType[] {
  return MEDIA_RELATION_TYPE_RULES[`${fromType}-${toType}`]
}
