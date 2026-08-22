export const TMDB_SOURCE_ID = 'tmdb'
export const TMDB_SITE_BASE_URL = 'https://www.themoviedb.org'
export const IMDB_SITE_BASE_URL = 'https://www.imdb.com'
/** Original-quality image variant; the app downscales what it stores. */
export const TMDB_IMAGE_SIZE = 'original'
/** Series an anime name search expands into per-season rows, most popular first. */
export const TMDB_NAME_SEARCH_SERIES_LIMIT = 6
/** Shows a name search returns, each already at entry grain. */
export const TMDB_NAME_SEARCH_SHOW_LIMIT = 10
/** Movies a name search returns, each already at entry grain. */
export const TMDB_NAME_SEARCH_MOVIE_LIMIT = 10
/**
 * Alternative titles kept as entry aliases. TMDB lists one per country and kind
 * — dozens for a popular show — while an alias list is read at a glance.
 */
export const TMDB_ALIAS_LIMIT = 5
/** How many of those may come from the locale's own countries. */
export const TMDB_LOCAL_ALIAS_LIMIT = 3
