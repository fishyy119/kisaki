/**
 * MangaDex API response models.
 *
 * Shapes verified against the live API; only fields this extension reads are
 * modeled, and every field is optional-tolerant. Localized strings arrive as
 * maps keyed by MangaDex locale codes such as `en`, `ja`, `ja-ro`, `zh`, and
 * `zh-hk`.
 */

export type MdLocalizedString = Record<string, string | undefined>

export interface MdTag {
  id: string
  attributes?: {
    name?: MdLocalizedString | null
    group?: string | null
  } | null
}

export interface MdRelationship {
  id: string
  type: string
  /** Only on `manga` relationships: how the target relates to this entry. */
  related?: string | null
  /** Present when the relationship was expanded through `includes[]`. */
  attributes?: Record<string, unknown> | null
}

export interface MdMangaAttributes {
  title?: MdLocalizedString | null
  altTitles?: MdLocalizedString[] | null
  description?: MdLocalizedString | null
  originalLanguage?: string | null
  lastVolume?: string | null
  lastChapter?: string | null
  status?: string | null
  year?: number | null
  contentRating?: string | null
  tags?: MdTag[] | null
  /** External links keyed by site code (`mal`, `al`, `raw`, `engtl`, ...). */
  links?: Record<string, string | undefined> | null
}

export interface MdManga {
  id: string
  attributes?: MdMangaAttributes | null
  relationships?: MdRelationship[] | null
}

export interface MdAuthorAttributes {
  name?: string | null
  imageUrl?: string | null
  biography?: MdLocalizedString | null
  twitter?: string | null
  pixiv?: string | null
  website?: string | null
}

export interface MdAuthor {
  id: string
  attributes?: MdAuthorAttributes | null
}

export interface MdCover {
  id: string
  attributes?: {
    fileName?: string | null
    volume?: string | null
    locale?: string | null
  } | null
}

export interface MdListResponse<T> {
  data?: T[] | null
  total?: number | null
  limit?: number | null
  offset?: number | null
}

export interface MdEntityResponse<T> {
  data?: T | null
}

export interface MdUser {
  id: string
  attributes?: { username?: string | null } | null
}

export interface MdStatusesResponse {
  /** Map of manga id to reading status. */
  statuses?: Record<string, string | undefined> | null
}

export interface MdRatingsResponse {
  /** Object map when non-empty; the API serializes the empty case as `[]`. */
  ratings?: Record<string, { rating?: number | null } | undefined> | unknown[] | null
}

export interface MdTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}
