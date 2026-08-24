export const IGDB_SOURCE_ID = 'igdb'
export const IGDB_SITE_BASE_URL = 'https://www.igdb.com'
export const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload'

/** Identifies this client to IGDB. */
export const IGDB_USER_AGENT = 'kisaki (+https://github.com/ximu3/kisaki)'

/** Results a name search returns. */
export const IGDB_SEARCH_RESULT_LIMIT = 25
/** Rows one Apicalypse query requests; the API caps it at 500. */
export const IGDB_QUERY_LIMIT = 500
/** Ids per by-id query, kept under the query-length limit. */
export const IGDB_ID_CHUNK_SIZE = 200
/** Characters kept from one game. */
export const IGDB_CHARACTER_LIMIT = 200
/** Involved-company rows read for one game. */
export const IGDB_INVOLVED_COMPANY_LIMIT = 500
/** Screenshots and artworks read for one game. */
export const IGDB_IMAGE_QUERY_LIMIT = 50
/** Keywords kept as tags; IGDB lists hundreds for popular titles. */
export const IGDB_KEYWORD_LIMIT = 100
/** Covers kept from one game. */
export const IGDB_COVER_LIMIT = 10
/** Screenshots and artworks kept as backdrops. */
export const IGDB_BACKDROP_LIMIT = 20

/**
 * Sources IGDB cross-references that Kisaki also stores ids for. Anything else
 * IGDB knows about (storefronts, regional listings) is not an id source here.
 */
export const IGDB_KNOWN_EXTERNAL_SOURCES = new Set(['igdb', 'vndb', 'steam', 'bangumi', 'ymgal'])
