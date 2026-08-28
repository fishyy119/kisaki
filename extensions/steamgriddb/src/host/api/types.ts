/**
 * SteamGridDB API v2 response models.
 *
 * Shapes verified against the live API; only fields this extension reads are
 * modeled, and every field is optional-tolerant.
 */

export interface SgdbGame {
  id: number
  name?: string | null
  /** Unix seconds. */
  release_date?: number | null
  verified?: boolean | null
}

export interface SgdbArtwork {
  id: number
  url?: string | null
  thumb?: string | null
  width?: number | null
  height?: number | null
  style?: string | null
  mime?: string | null
  nsfw?: boolean | null
}

export interface SgdbListResponse<T> {
  success?: boolean
  data?: T[] | null
}

export interface SgdbEntityResponse<T> {
  success?: boolean
  data?: T | null
}
