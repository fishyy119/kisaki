import type { TmdbMovieDetail, TmdbSeriesDetail } from '../../api/types'
import { trimToUndefined } from './text'

export interface TmdbEntryName {
  name: string
  originalName?: string
}

/**
 * TMDB has no title for a season on its own, so a season entry is named by
 * qualifying the show. Season 1 keeps the bare show name: it is how a single
 * season show reads, and how libraries label the first season of a long one.
 */
export function composeSeasonEntryName(
  seriesName: string,
  seasonName: string | null | undefined,
  seasonNumber: number
): string {
  if (seasonNumber === 1) {
    return seriesName
  }

  // Not user-facing copy: a neutral stand-in for a season TMDB left unnamed.
  return qualify(seriesName, trimToUndefined(seasonName) ?? `Season ${seasonNumber}`)
}

/** `partName` already names the group and, when useful, its episode group. */
export function composeEpisodeGroupEntryName(seriesName: string, partName: string): string {
  return qualify(seriesName, partName)
}

export function readSeriesNames(series: TmdbSeriesDetail): TmdbEntryName {
  return toEntryName(series.name, series.original_name, series.id)
}

export function readMovieNames(movie: TmdbMovieDetail): TmdbEntryName {
  return toEntryName(movie.title, movie.original_title, movie.id)
}

function toEntryName(
  localized: string | undefined,
  original: string | undefined,
  id: number
): TmdbEntryName {
  const originalName = trimToUndefined(original)
  // Not user-facing copy: TMDB always titles an entry, so this only guards
  // against a malformed response reaching the library as an empty name.
  const name = trimToUndefined(localized) ?? originalName ?? `TMDB ${id}`

  return originalName && originalName !== name ? { name, originalName } : { name }
}

/** Avoids "Show Show Season 2" when TMDB already qualified the part name. */
function qualify(seriesName: string, part: string): string {
  return part.toLowerCase().includes(seriesName.toLowerCase()) ? part : `${seriesName} ${part}`
}
