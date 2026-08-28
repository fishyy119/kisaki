export const MAL_EXTENSION_ID = 'builtin.mal'
export const MAL_SOURCE_ID = 'mal'

export const MAL_SITE_URL = 'https://myanimelist.net'

/**
 * Public OAuth client id of the registered Kisaki app (App Type "other", no
 * secret is issued for it). A public client id is not a secret by design.
 */
export const MAL_OAUTH_CLIENT_ID = '2ece0a67f303fb6ee22a725f697ffb92'

export const MAL_OAUTH_AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize'
export const MAL_OAUTH_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'

/** MAL publishes no numeric budget; stay conservatively below abuse levels. */
export const MAL_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 50,
  windowMs: 60_000
}

/** The Tenrai mirror asks for about 3 requests per second. */
export const MAL_MIRROR_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 2,
  windowMs: 1_000
}

export const MAL_SEARCH_RESULT_LIMIT = 15
/** Page size for official list reads (maximum the API allows is 1000). */
export const MAL_LIST_PAGE_SIZE = 500
/** Upper bound of mirror pagination pages one scrape reads per slot. */
export const MAL_MIRROR_MAX_PAGES = 4

export const MAL_LOGIN_TIMEOUT_MS = 300_000

/** Refresh this early before the stored access token expires. */
export const MAL_TOKEN_REFRESH_LEEWAY_MS = 60_000
