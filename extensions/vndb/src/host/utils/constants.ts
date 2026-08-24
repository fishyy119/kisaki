export const VNDB_SOURCE_ID = 'vndb'
export const VNDB_SITE_BASE_URL = 'https://vndb.org'

/** Identifies this client to VNDB, as the API terms ask. */
export const VNDB_USER_AGENT = 'kisaki (+https://github.com/ximu3/kisaki)'

/** Results a name search returns. */
export const VNDB_SEARCH_RESULT_LIMIT = 25
/** Rows one query page requests; the API caps it at 100. */
export const VNDB_QUERY_PAGE_SIZE = 100
/** Pages one paged query walks before stopping. */
export const VNDB_MAX_QUERY_PAGES = 10
/** Ids per by-id query, kept well under the filter-size limit. */
export const VNDB_ID_CHUNK_SIZE = 80
/** Covers kept from one visual novel. */
export const VNDB_COVER_LIMIT = 10
/** Screenshots kept as backdrops. */
export const VNDB_BACKDROP_LIMIT = 20
