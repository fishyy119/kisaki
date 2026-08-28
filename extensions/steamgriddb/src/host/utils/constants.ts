export const SGDB_EXTENSION_ID = 'builtin.steamgriddb'
export const SGDB_SOURCE_ID = 'steamgriddb'
/** Source id the Steam extension owns; a Steam app id resolves directly. */
export const STEAM_SOURCE_ID = 'steam'

export const SGDB_API_URL = 'https://www.steamgriddb.com/api/v2'

/** SteamGridDB publishes no numeric budget; stay conservatively low. */
export const SGDB_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 2,
  windowMs: 1_000
}

export const SGDB_SEARCH_RESULT_LIMIT = 15
/** Art URLs stated per slot; the community uploads far more. */
export const SGDB_ART_RESULT_LIMIT = 20
/** Grid dimensions matching the library's portrait cover shape. */
export const SGDB_COVER_DIMENSIONS = '600x900'
