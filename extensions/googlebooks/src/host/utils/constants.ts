export const GBOOKS_EXTENSION_ID = 'builtin.googlebooks'
export const GBOOKS_SOURCE_ID = 'googlebooks'
/** The shared cross-source book id. */
export const ISBN_SOURCE_ID = 'isbn'

export const GBOOKS_API_URL = 'https://www.googleapis.com/books/v1'

/** Keyless quota is a shared pool; pace conservatively either way. */
export const GBOOKS_RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 2,
  windowMs: 1_000
}

export const GBOOKS_SEARCH_RESULT_LIMIT = 15
/** Page size for authenticated shelf reads (the API caps at 40). */
export const GBOOKS_SHELF_PAGE_SIZE = 40
export const GBOOKS_LOGIN_TIMEOUT_MS = 300_000

/**
 * Predefined bookshelf ids of the Books API.
 * 2 = To read, 3 = Reading now, 4 = Have read, 7 = My Google eBooks.
 */
export const GBOOKS_SHELF_TO_READ = 2
export const GBOOKS_SHELF_READING_NOW = 3
export const GBOOKS_SHELF_HAVE_READ = 4
export const GBOOKS_SHELF_MY_EBOOKS = 7
