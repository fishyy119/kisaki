export const YMGAL_SOURCE_ID = 'ymgal'
export const YMGAL_SITE_BASE_URL = 'https://www.ymgal.games'
export const YMGAL_CDN_BASE_URL = 'https://cdn.ymgal.games'

/**
 * Shared client YMGal publishes for open API access. It is documented as
 * public on the developer page, so the extension works with no setup; a user
 * who applied for a dedicated client stores it in the extension secrets and
 * gets their own rate-limit pool.
 */
export const YMGAL_PUBLIC_CLIENT_ID = 'ymgal'
export const YMGAL_PUBLIC_CLIENT_SECRET = 'luna0327'
export const YMGAL_TOKEN_SCOPE = 'public'

/** Games a name search returns. */
export const YMGAL_SEARCH_RESULT_LIMIT = 25
/** Page size of one list-mode search request; the API caps it at 20. */
export const YMGAL_SEARCH_PAGE_SIZE = 20
/** Minimum similarity for the accurate-mode search that seeds the results. */
export const YMGAL_ACCURATE_SEARCH_SIMILARITY = 70
/** Covers kept from one game archive. */
export const YMGAL_COVER_LIMIT = 10
