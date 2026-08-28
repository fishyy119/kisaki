export const STEAM_EXTENSION_ID = 'builtin.steam'
export const STEAM_SOURCE_ID = 'steam'

export const STEAM_STORE_API_URL = 'https://store.steampowered.com/api'
export const STEAM_WEB_API_URL = 'https://api.steampowered.com'
export const STEAM_STORE_PAGE_URL = 'https://store.steampowered.com/app'
/** Store item assets CDN; capsule and hero art live here without any API. */
export const STEAM_ASSETS_URL =
  'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps'

/**
 * The store API budget is roughly 200 requests per five minutes; pace well
 * under it because responses are also cached.
 */
export const STEAM_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 1,
  windowMs: 1_500
}

export const STEAM_SEARCH_RESULT_LIMIT = 15

/** App details cache: entries served fresh within the TTL, capped by count. */
export const STEAM_APPDETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const STEAM_APPDETAILS_CACHE_MAX_ENTRIES = 200
