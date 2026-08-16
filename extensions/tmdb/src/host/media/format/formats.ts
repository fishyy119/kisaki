import type { LibraryMovieFormat, LibraryTvFormat } from '@kisaki3/extension-sdk'
import type { TmdbGenre } from '../../api/types'

/**
 * TMDB genre ids the format mappers read.
 *
 * A genre is the only format signal a search row carries, and for a film it is
 * the only one TMDB states at all.
 */
const GENRE_DOCUMENTARY = 99
const GENRE_TV_MOVIE = 10770
const GENRE_TV_NEWS = 10763
const GENRE_TV_REALITY = 10764
const GENRE_TV_TALK = 10767

/** A short is a film under this runtime; the boundary follows the Academy's. */
const SHORT_FILM_MAX_MINUTES = 40

/** TMDB show kinds, as served by the series detail's `type`. */
const TV_FORMAT_BY_TYPE: Record<string, LibraryTvFormat> = {
  scripted: 'scripted',
  miniseries: 'miniseries',
  documentary: 'documentary',
  reality: 'reality',
  'talk show': 'talkShow',
  news: 'news',
  video: 'other'
}

/**
 * Format of a show.
 *
 * `type` is the statement TMDB makes about the kind of show, so it decides
 * whenever it is present; genres answer for a search row, which carries no
 * type. Neither being conclusive leaves the entry scripted, which is what the
 * overwhelming majority of shows are.
 */
export function readTmdbTvFormat(
  type: string | undefined,
  genreIds: readonly number[]
): LibraryTvFormat {
  const byType = TV_FORMAT_BY_TYPE[type?.trim().toLowerCase() ?? '']
  if (byType) {
    return byType
  }

  if (genreIds.includes(GENRE_DOCUMENTARY)) return 'documentary'
  if (genreIds.includes(GENRE_TV_REALITY)) return 'reality'
  if (genreIds.includes(GENRE_TV_TALK)) return 'talkShow'
  if (genreIds.includes(GENRE_TV_NEWS)) return 'news'

  return 'scripted'
}

/**
 * Format of a film.
 *
 * TMDB states no release format, so the genres carry what it does say and the
 * runtime tells a short from a feature. A film with neither signal is
 * theatrical, which is what a catalogued film usually is.
 */
export function readTmdbMovieFormat(
  genreIds: readonly number[],
  runtimeMinutes?: number | null
): LibraryMovieFormat {
  if (genreIds.includes(GENRE_TV_MOVIE)) return 'tvMovie'
  if (genreIds.includes(GENRE_DOCUMENTARY)) return 'documentary'

  if (
    typeof runtimeMinutes === 'number' &&
    Number.isFinite(runtimeMinutes) &&
    runtimeMinutes > 0 &&
    runtimeMinutes <= SHORT_FILM_MAX_MINUTES
  ) {
    return 'short'
  }

  return 'theatrical'
}

export function readTmdbGenreIds(genres: readonly TmdbGenre[] | undefined): number[] {
  return (genres ?? []).map((genre) => genre.id)
}
