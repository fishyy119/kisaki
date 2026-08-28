export const ANILIST_EXTENSION_ID = 'builtin.anilist'
export const ANILIST_SOURCE_ID = 'anilist'
/** Source id the MAL extension owns; AniList states MAL ids and hands them over. */
export const MAL_SOURCE_ID = 'mal'

export const ANILIST_SITE_URL = 'https://anilist.co'

/** The API is degraded to 30 requests per minute; stay under it. */
export const ANILIST_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 28,
  windowMs: 60_000
}

export const ANILIST_SEARCH_RESULT_LIMIT = 15
/** Page size for nested character and staff connections. */
export const ANILIST_CONNECTION_PAGE_SIZE = 25
/** Upper bound of connection pages one scrape reads per slot. */
export const ANILIST_CONNECTION_MAX_PAGES = 3

export const ANILIST_LOGIN_TIMEOUT_MS = 300_000
