/**
 * Response models for the official MAL API v2 and the Jikan-compatible
 * mirror. Shapes verified against live responses; only fields this extension
 * reads are modeled, and every field is optional-tolerant.
 */

export interface MalPicture {
  medium?: string | null
  large?: string | null
}

export interface MalAlternativeTitles {
  synonyms?: string[] | null
  en?: string | null
  ja?: string | null
}

export interface MalNamedRef {
  id: number
  name?: string | null
}

export interface MalEntryNode {
  id: number
  title?: string | null
  main_picture?: MalPicture | null
  alternative_titles?: MalAlternativeTitles | null
  media_type?: string | null
  /** ISO date, sometimes year or year-month only. */
  start_date?: string | null
}

export interface MalRelatedEdge {
  node?: MalEntryNode | null
  relation_type?: string | null
}

export interface MalAuthorEdge {
  node?: {
    id: number
    first_name?: string | null
    last_name?: string | null
  } | null
  role?: string | null
}

export interface MalSerializationEdge {
  node?: MalNamedRef | null
}

export interface MalAnimeDetail extends MalEntryNode {
  synopsis?: string | null
  status?: string | null
  genres?: MalNamedRef[] | null
  num_episodes?: number | null
  source?: string | null
  average_episode_duration?: number | null
  studios?: MalNamedRef[] | null
  pictures?: MalPicture[] | null
  related_anime?: MalRelatedEdge[] | null
  related_manga?: MalRelatedEdge[] | null
}

export interface MalMangaDetail extends MalEntryNode {
  synopsis?: string | null
  status?: string | null
  genres?: MalNamedRef[] | null
  num_volumes?: number | null
  num_chapters?: number | null
  authors?: MalAuthorEdge[] | null
  serialization?: MalSerializationEdge[] | null
  pictures?: MalPicture[] | null
  related_anime?: MalRelatedEdge[] | null
  related_manga?: MalRelatedEdge[] | null
}

export interface MalSearchPage {
  data?: { node: MalEntryNode }[] | null
  paging?: { next?: string | null } | null
}

export interface MalUser {
  id: number
  name?: string | null
}

export interface MalListStatus {
  status?: string | null
  /** Integer 0-10; 0 means unscored. */
  score?: number | null
}

export interface MalListPage {
  data?: { node: MalEntryNode; list_status?: MalListStatus | null }[] | null
  paging?: { next?: string | null } | null
}

export interface MalTokenResponse {
  token_type?: string
  expires_in?: number
  access_token?: string
  refresh_token?: string
}

// --- Jikan-compatible mirror shapes ---

export interface MirrorImages {
  jpg?: { image_url?: string | null } | null
  webp?: { image_url?: string | null } | null
}

export interface MirrorPersonRef {
  mal_id: number
  url?: string | null
  images?: MirrorImages | null
  /** Formatted as "Family, Given" by MAL convention. */
  name?: string | null
}

export interface MirrorCharacterRef {
  mal_id: number
  url?: string | null
  images?: MirrorImages | null
  /** Formatted as "Family, Given" by MAL convention. */
  name?: string | null
}

export interface MirrorCharacterEdge {
  character?: MirrorCharacterRef | null
  role?: string | null
  voice_actors?: { person?: MirrorPersonRef | null; language?: string | null }[] | null
}

export interface MirrorStaffEdge {
  person?: MirrorPersonRef | null
  positions?: string[] | null
}

export interface MirrorEpisode {
  mal_id: number
  url?: string | null
  title?: string | null
  title_japanese?: string | null
  /** Seconds. */
  duration?: number | null
  /** ISO timestamp. */
  aired?: string | null
  filler?: boolean | null
  recap?: boolean | null
}

export interface MirrorPage<T> {
  data?: T[] | null
  pagination?: {
    last_visible_page?: number | null
    has_next_page?: boolean | null
  } | null
}
