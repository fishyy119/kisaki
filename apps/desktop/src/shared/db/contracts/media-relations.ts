/**
 * Media relation vocabulary.
 *
 * Media relations are directed edges between media entries stored in the
 * polymorphic `media_relations` table. Rows are stored exactly as written
 * (scrape or edit); readers merge both directions, labelling incoming edges
 * through the total inverse map, so a half-written pair stays visible from
 * both endpoints.
 *
 * The vocabulary states narrative derivation between two entries and nothing
 * else. Group facts such as a shared setting are n-ary and belong in a
 * collection, and a shared cast is already encoded by two entries linking the
 * same character; neither becomes an edge type here.
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

/**
 * Cross-type pairs carry provenance plus the side-story pair: an anime's spin-off
 * game and a visual novel's fandisc adaptation are told across media, so the
 * derivation an edge states does not narrow to one type.
 */
const CROSS_TYPE_RELATION_TYPES: readonly MediaRelationType[] = [
  'adaptation',
  'sourceMaterial',
  'sideStory',
  'parentStory',
  'other'
]

/**
 * Allowed relation types per ordered endpoint pair. Same-type pairs carry the
 * full vocabulary (sequels, summaries, versions). Adding a media type forces
 * entries here at compile time.
 *
 * Which structures that vocabulary expresses follows entry grain: anime seasons
 * are separate entries joined by these edges, so a franchise is a connected
 * component of the graph rather than a row.
 */
export const MEDIA_RELATION_TYPE_RULES: Record<MediaTypePair, readonly MediaRelationType[]> = {
  'game-game': SAME_TYPE_RELATION_TYPES,
  'anime-anime': SAME_TYPE_RELATION_TYPES,
  'comic-comic': SAME_TYPE_RELATION_TYPES,
  'novel-novel': SAME_TYPE_RELATION_TYPES,
  'game-anime': CROSS_TYPE_RELATION_TYPES,
  'game-comic': CROSS_TYPE_RELATION_TYPES,
  'game-novel': CROSS_TYPE_RELATION_TYPES,
  'anime-game': CROSS_TYPE_RELATION_TYPES,
  'anime-comic': CROSS_TYPE_RELATION_TYPES,
  'anime-novel': CROSS_TYPE_RELATION_TYPES,
  'comic-game': CROSS_TYPE_RELATION_TYPES,
  'comic-anime': CROSS_TYPE_RELATION_TYPES,
  'comic-novel': CROSS_TYPE_RELATION_TYPES,
  'novel-game': CROSS_TYPE_RELATION_TYPES,
  'novel-anime': CROSS_TYPE_RELATION_TYPES,
  'novel-comic': CROSS_TYPE_RELATION_TYPES
}

/** Allowed relation types for a directed edge from `fromType` to `toType`. */
export function getMediaRelationTypeRules(
  fromType: MediaType,
  toType: MediaType
): readonly MediaRelationType[] {
  return MEDIA_RELATION_TYPE_RULES[`${fromType}-${toType}`]
}
