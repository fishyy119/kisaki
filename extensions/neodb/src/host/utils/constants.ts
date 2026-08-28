export const NEODB_EXTENSION_ID = 'builtin.neodb'
export const NEODB_SOURCE_ID = 'neodb'
/** Source ids owned elsewhere; NeoDB hands their ids over when stated. */
export const ISBN_SOURCE_ID = 'isbn'
export const DOUBAN_SOURCE_ID = 'douban'
export const BANGUMI_SOURCE_ID = 'bangumi'
export const GOODREADS_SOURCE_ID = 'goodreads'
export const OPENLIBRARY_SOURCE_ID = 'openlibrary'

/** Conservative pace; instances are community-run. */
export const NEODB_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 2,
  windowMs: 1_000
}

export const NEODB_SEARCH_RESULT_LIMIT = 15
export const NEODB_LOGIN_TIMEOUT_MS = 300_000
/** OAuth out-of-band redirect for instances that cannot bounce back. */
export const NEODB_OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'
export const NEODB_OAUTH_SCOPE = 'read write'
export const NEODB_CLIENT_NAME = 'Kisaki'
export const NEODB_CLIENT_WEBSITE = 'https://kisaki.me'
