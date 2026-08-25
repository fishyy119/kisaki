/**
 * Bangumi API Types
 *
 * Based on the official OpenAPI schema:
 * - https://bangumi.github.io/api/
 * - https://bangumi.github.io/api/dist.json
 * - https://github.com/bangumi/api/
 *
 * Only fields used by Kisaki scraper are modeled here.
 */

import type { BangumiMediaScope, BangumiSupportedSubjectType } from '../../shared/scopes'

// =============================================================================
// Shared
// =============================================================================

export type BangumiSubjectType = BangumiSupportedSubjectType | 6
export type BangumiPersonType = 1 | 2 | 3
export type BangumiCharacterType = 1 | 2 | 3 | 4
export type BangumiBloodType = 1 | 2 | 3 | 4

export interface BangumiImages {
  large?: string
  common?: string
  medium?: string
  small?: string
  grid?: string
}

export interface BangumiPersonImages {
  large?: string
  medium?: string
  small?: string
  grid?: string
}

export interface BangumiInfoboxValue {
  k?: string
  v: string
}

export interface BangumiInfoboxItem {
  key: string
  value: string | BangumiInfoboxValue[]
}

export interface BangumiTag {
  name: string
  count: number
  total_cont?: number
}

export interface BangumiPaged<T> {
  total: number
  limit: number
  offset: number
  data: T[]
}

export interface BangumiPageQuery {
  limit?: number
  offset?: number
}

export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5

// =============================================================================
// Account
// =============================================================================

export interface BangumiMe {
  id: number
  username: string
  nickname: string
  avatar?: BangumiImages | null
  sign?: string
  user_group?: number
}

// =============================================================================
// Subject
// =============================================================================

export interface BangumiSubject {
  id: number
  type: BangumiSubjectType
  name: string
  name_cn: string
  summary: string
  date?: string
  platform?: string
  /** Episode count declared by the entry; `total_episodes` counts known rows. */
  eps?: number
  total_episodes?: number
  /** Volume count of a book subject, parsed server-side from the infobox. */
  volumes?: number
  images?: BangumiImages | null
  infobox?: BangumiInfoboxItem[] | null
  tags?: BangumiTag[] | null
  meta_tags?: string[] | null
  nsfw?: boolean
}

export interface BangumiSubjectRelation {
  id: number
  type: BangumiSubjectType
  name: string
  name_cn: string
  relation: string
  images?: BangumiImages | null
}

// =============================================================================
// Person
// =============================================================================

export type BangumiPersonCareer =
  'producer' | 'mangaka' | 'artist' | 'seiyu' | 'writer' | 'illustrator' | 'actor' | string

export interface BangumiPerson {
  id: number
  name: string
  type: BangumiPersonType
  career: BangumiPersonCareer[]
  images?: BangumiPersonImages | null
  short_summary?: string
  locked?: boolean
}

export interface BangumiRelatedPerson {
  id: number
  name: string
  type: BangumiPersonType
  career: BangumiPersonCareer[]
  images?: BangumiPersonImages | null
  relation: string
  eps?: string
}

export interface BangumiPersonDetail {
  id: number
  name: string
  type: BangumiPersonType
  career: BangumiPersonCareer[]
  images?: BangumiPersonImages | null
  summary: string
  infobox?: BangumiInfoboxItem[] | null
  gender?: string | null
  blood_type?: BangumiBloodType | null
  birth_year?: number | null
  birth_mon?: number | null
  birth_day?: number | null
}

// =============================================================================
// Character
// =============================================================================

export interface BangumiCharacter {
  id: number
  name: string
  type: BangumiCharacterType
  summary: string
  images?: BangumiPersonImages | null
  short_summary?: string
}

export interface BangumiRelatedCharacter {
  id: number
  name: string
  summary: string
  type: BangumiCharacterType
  images?: BangumiPersonImages | null
  relation: string
  actors?: BangumiPerson[]
}

export interface BangumiCharacterDetail {
  id: number
  name: string
  type: BangumiCharacterType
  summary: string
  images?: BangumiPersonImages | null
  infobox?: BangumiInfoboxItem[] | null
  gender?: string | null
  blood_type?: BangumiBloodType | null
  birth_year?: number | null
  birth_mon?: number | null
  birth_day?: number | null
}

export interface BangumiCharacterPerson {
  id: number
  name: string
  type: BangumiCharacterType
  images?: BangumiPersonImages | null
  subject_id: number
  subject_type: BangumiSubjectType
  subject_name: string
  subject_name_cn: string
  staff?: string
}

// =============================================================================
// Episode
// =============================================================================

/**
 * `0` main story, `1` special, `2` opening, `3` ending, `4` trailer, `5` MAD,
 * `6` other. Only main story and specials become library episodes.
 */
export type BangumiEpisodeType = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface BangumiEpisode {
  id: number
  type: BangumiEpisodeType
  name: string
  name_cn: string
  /** Number within its own type; `ep` is the main-story number when known. */
  sort: number
  ep?: number | null
  airdate?: string
  duration?: string
  duration_seconds?: number | null
  desc?: string
  subject_id: number
}

export interface BangumiEpisodeQuery extends BangumiPageQuery {
  type?: BangumiEpisodeType
}

// =============================================================================
// Search
// =============================================================================

export interface BangumiSearchSubjectPayload {
  keyword: string
  sort?: 'match' | 'heat' | 'rank' | 'score'
  filter?: {
    type?: BangumiSubjectType[]
    meta_tags?: string[]
    tag?: string[]
    air_date?: string[]
    rating?: string[]
    rating_count?: string[]
    rank?: string[]
    nsfw?: boolean
  }
}

export type BangumiImageType = 'small' | 'grid' | 'large' | 'medium' | 'common'
export type BangumiEntityImageType = 'small' | 'grid' | 'large' | 'medium'

// =============================================================================
// Collections
// =============================================================================

export interface BangumiUserCollection {
  subject_id?: number
  subject?: BangumiSubject | null
  type: BangumiCollectionType
  rate?: number
  comment?: string
  tags?: string[]
  private?: boolean
  updated_at?: string
  /** Finished volume count; only book subjects carry one. */
  vol_status?: number
  /** Finished episode or chapter count, returned for every subject type. */
  ep_status?: number
}

export interface BangumiCollectionQuery extends BangumiPageQuery {
  scope?: BangumiMediaScope
  subject_type?: BangumiSubjectType
  type?: BangumiCollectionType
}

export interface BangumiCollectionPatch {
  type?: BangumiCollectionType
  rate?: number
  tags?: readonly string[]
  // Bangumi only accepts completion counts for book subjects: sending them for
  // a video subject has effects the API documents as unintended.
  /** Finished volume count. */
  vol_status?: number
  /** Finished chapter count. */
  ep_status?: number
}

/** Per-episode collection state: 0 none, 1 wish, 2 watched, 3 dropped. */
export type BangumiEpisodeCollectionType = 0 | 1 | 2 | 3

export interface BangumiEpisodeCollection {
  episode: BangumiEpisode
  type: BangumiEpisodeCollectionType
}

// =============================================================================
// Indices
// =============================================================================

export interface BangumiIndex {
  id: number
  title: string
  desc?: string
  total?: number
}

export interface BangumiIndexSubject {
  id: number
  type: BangumiSubjectType
  name: string
  name_cn?: string
  images?: BangumiImages | null
  comment?: string
  added_at?: string
}

export interface BangumiIndexSubjectsQuery extends BangumiPageQuery {
  scope?: BangumiMediaScope
  type?: BangumiSubjectType
}
