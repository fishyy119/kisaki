/**
 * NeoDB API response models.
 *
 * Shapes verified against the live flagship instance; only fields this
 * extension reads are modeled, and every field is optional-tolerant.
 */

export interface NdLocalizedText {
  lang?: string | null
  text?: string | null
}

export interface NdExternalResource {
  url?: string | null
}

export interface NdItem {
  uuid: string
  /** Site-relative page path such as `/book/{uuid}`. */
  url?: string | null
  category?: string | null
  title?: string | null
  display_title?: string | null
  description?: string | null
  brief?: string | null
  cover_image_url?: string | null
  rating?: number | null
  localized_title?: NdLocalizedText[] | null
  localized_description?: NdLocalizedText[] | null
  external_resources?: NdExternalResource[] | null
}

export interface NdBook extends NdItem {
  subtitle?: string | null
  orig_title?: string | null
  author?: string[] | null
  translator?: string[] | null
  language?: string[] | null
  pub_house?: string | null
  pub_year?: number | null
  pub_month?: number | null
  isbn?: string | null
  series?: string | null
  imprint?: string | null
  pages?: number | null
  tags?: string[] | null
}

export interface NdPagedResponse<T> {
  data?: T[] | null
  pages?: number | null
  count?: number | null
}

export interface NdUser {
  username?: string | null
  display_name?: string | null
  url?: string | null
}

/** Mastodon-style shelf type. */
export type NdShelfType = 'wishlist' | 'progress' | 'complete' | 'dropped'

export interface NdMark {
  shelf_type?: string | null
  visibility?: number | null
  /** Integer 1-10. */
  rating_grade?: number | null
  comment_text?: string | null
  item?: NdItem | null
}

export interface NdAppRegistration {
  client_id?: string
  client_secret?: string
}

export interface NdTokenResponse {
  access_token?: string
  token_type?: string
}
