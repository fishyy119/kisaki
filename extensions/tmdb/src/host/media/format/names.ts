import type { TmdbAlternativeTitle } from '../../api/types'
import { TMDB_ALIAS_LIMIT, TMDB_LOCAL_ALIAS_LIMIT } from '../../utils/constants'
import { trimToUndefined } from './text'

export interface TmdbEntryName {
  name: string
  originalName?: string
}

/** The naming fields every TMDB show row carries, detail or search result. */
interface TmdbSeriesNaming {
  id: number
  name?: string
  original_name?: string
}

/** The naming fields every TMDB film row carries, detail or search result. */
interface TmdbMovieNaming {
  id: number
  title?: string
  original_title?: string
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

/** After the locale's own countries: the original market, then English. */
const FALLBACK_TITLE_COUNTRIES = ['JP', 'US', 'GB']

/** TMDB contributors mark a title that belongs to one season with its number. */
const SEASON_TITLE_TYPE = /^s(\d+)$/i

export interface TmdbAliasOptions {
  /** Countries whose titles read as the locale's own, in preference order. */
  localCountries: readonly string[]
  /** Names the entry already displays; matched case-insensitively. */
  exclude: readonly (string | undefined)[]
  /** Season this entry mirrors, so the other seasons' titles are dropped. */
  seasonNumber?: number
}

/**
 * Alternative titles as library aliases, most useful first.
 *
 * TMDB returns one row per country and kind sorted by country code, so the head
 * of the list is alphabetical rather than relevant and a popular show carries
 * dozens of rows. Titles are therefore ranked by country — the locale's own,
 * then the original market, then English — and everything outside that
 * preference is dropped: a title in a language the reader does not use is not a
 * name they would search by.
 */
export function readAlternativeTitles(
  titles: readonly TmdbAlternativeTitle[],
  options: TmdbAliasOptions
): string[] {
  const preference = [...options.localCountries, ...FALLBACK_TITLE_COUNTRIES]
  const excluded = new Set(
    options.exclude.map((value) => value?.trim().toLowerCase()).filter((value) => !!value)
  )

  const ranked: { title: string; rank: number; isLocal: boolean }[] = []
  const seen = new Set<string>()

  for (const entry of titles) {
    const title = trimToUndefined(entry.title)
    if (!title) continue

    const key = title.toLowerCase()
    if (excluded.has(key) || seen.has(key)) continue
    if (statesOtherSeason(entry.type, options.seasonNumber)) continue

    const rank = preference.indexOf(entry.iso_3166_1?.toUpperCase() ?? '')
    if (rank === -1) continue

    seen.add(key)
    ranked.push({ title, rank, isLocal: rank < options.localCountries.length })
  }

  // A stable sort keeps TMDB's own order within one country, as artwork does.
  const selected: string[] = []
  let localCount = 0

  for (const entry of ranked.sort((a, b) => a.rank - b.rank)) {
    if (selected.length >= TMDB_ALIAS_LIMIT) break
    if (entry.isLocal) {
      if (localCount >= TMDB_LOCAL_ALIAS_LIMIT) continue
      localCount++
    }

    selected.push(entry.title)
  }

  return selected
}

/** Whether a title belongs to a season other than the one being scraped. */
function statesOtherSeason(type: string | undefined, seasonNumber: number | undefined): boolean {
  if (seasonNumber === undefined) return false

  const marked = SEASON_TITLE_TYPE.exec(type?.trim() ?? '')
  return marked !== null && Number(marked[1]) !== seasonNumber
}

export function readSeriesNames(series: TmdbSeriesNaming): TmdbEntryName {
  return toEntryName(series.name, series.original_name, series.id)
}

export function readMovieNames(movie: TmdbMovieNaming): TmdbEntryName {
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
