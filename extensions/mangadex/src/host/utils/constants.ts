export const MANGADEX_EXTENSION_ID = 'builtin.mangadex'
export const MANGADEX_SOURCE_ID = 'mangadex'
/** Source ids owned by sibling extensions; MangaDex hands their ids over. */
export const MAL_SOURCE_ID = 'mal'
export const ANILIST_SOURCE_ID = 'anilist'

export const MANGADEX_SITE_URL = 'https://mangadex.org'
export const MANGADEX_UPLOADS_URL = 'https://uploads.mangadex.org'
export const MANGADEX_AUTH_TOKEN_URL =
  'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token'
export const MANGADEX_CLIENT_SETTINGS_URL = 'https://mangadex.org/settings'

/** MangaDex allows 5 requests per second globally; stay under it. */
export const MANGADEX_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 4,
  windowMs: 1_000
}

export const MANGADEX_SEARCH_RESULT_LIMIT = 15
/** Page size for cover listings; MangaDex caps list endpoints at 100. */
export const MANGADEX_COVER_PAGE_SIZE = 100
/** Rating reads accept at most 100 manga ids per call. */
export const MANGADEX_RATING_BATCH_SIZE = 100

/** Refresh this early before the stored access token expires. */
export const MANGADEX_TOKEN_REFRESH_LEEWAY_MS = 60_000
