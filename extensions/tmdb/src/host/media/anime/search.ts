import type { AnimeSearchResult, LibraryAnimeFormat } from '@kisaki3/extension-sdk'
import { isCancellationError } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import type {
  TmdbEpisodeGroupDetail,
  TmdbSearchMovie,
  TmdbSearchSeries,
  TmdbSeriesDetail
} from '../../api/types'
import {
  formatTmdbSubjectId,
  parseTmdbRef,
  readTmdbSeriesId,
  type TmdbRef,
  type TmdbSubjectRef
} from '../../identity/subject-id'
import {
  TMDB_NAME_SEARCH_MOVIE_LIMIT,
  TMDB_NAME_SEARCH_SERIES_LIMIT,
  TMDB_SOURCE_ID
} from '../../utils/constants'
import { mapWithConcurrency } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import {
  composeSeasonEntryName,
  composeEpisodeGroupEntryName,
  readSeriesNames
} from '../format/names'
import { trimToUndefined } from '../format/text'
import {
  composeEpisodeGroupPartName,
  readEpisodeGroupItems,
  readEpisodeGroupSeriesId
} from './episode-groups'

/** Episode groups whose parts a reference expansion enumerates. */
const EXPANDED_EPISODE_GROUP_LIMIT = 8
const DETAIL_FETCH_CONCURRENCY = 4

export interface TmdbAnimeSearchOptions {
  language: string
  includeAdult: boolean
  signal: AbortSignal
}

/**
 * TMDB search for anime entries.
 *
 * Every row is one entry's worth of TMDB: a film, a season, or one part of an
 * episode group. A show as a whole is never offered, because an anime entry is
 * a single flat episode list and the library keeps one entry per season, linked
 * to its neighbours by relations.
 *
 * A query is read as a reference first: pasting an id or a themoviedb.org link
 * enumerates every season and every part of every episode group that show has,
 * so binding an entry to an episode group never requires leaving the app.
 * Anything else is a name search, where series are expanded into their seasons.
 */
export async function searchTmdbAnime(
  client: TmdbClient,
  query: string,
  options: TmdbAnimeSearchOptions
): Promise<AnimeSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const ref = parseTmdbRef(trimmed)
  return ref ? expandReference(client, ref, options) : searchByName(client, trimmed, options)
}

async function expandReference(
  client: TmdbClient,
  ref: TmdbRef,
  options: TmdbAnimeSearchOptions
): Promise<AnimeSearchResult[]> {
  const request = { language: options.language, signal: options.signal }

  if (ref.kind === 'movie') {
    const movie = await client.getMovie(ref.movieId, request)
    return [
      toResult(ref, movie.title ?? '', movie.original_title, movie.release_date, 'movie', movie.id)
    ]
  }

  const seriesId =
    ref.kind === 'episodeGroupSet'
      ? readEpisodeGroupSeriesId(await client.getEpisodeGroup(ref.setId, request))
      : readTmdbSeriesId(ref)
  if (seriesId === null || seriesId === undefined) {
    return []
  }

  const series = await client.getSeries(seriesId, request)
  const groups = await loadEpisodeGroups(client, seriesId, options)
  return [...buildSeasonRows(series), ...buildEpisodeGroupRows(series, groups)]
}

async function searchByName(
  client: TmdbClient,
  query: string,
  options: TmdbAnimeSearchOptions
): Promise<AnimeSearchResult[]> {
  const searchOptions = {
    language: options.language,
    includeAdult: options.includeAdult,
    signal: options.signal
  }
  const [seriesPage, moviePage] = await Promise.all([
    client.searchSeries(query, searchOptions),
    client.searchMovies(query, searchOptions)
  ])

  // Only a series detail lists the seasons a row can stand for, so the series
  // a name search can show at all are the ones it expands.
  const series = [...(seriesPage.results ?? [])]
    .sort(byPopularity)
    .slice(0, TMDB_NAME_SEARCH_SERIES_LIMIT)
  const movies = (moviePage.results ?? []).slice(0, TMDB_NAME_SEARCH_MOVIE_LIMIT)
  const details = await loadSeriesDetails(
    client,
    series.map((entry) => entry.id),
    options
  )

  const candidates: (
    { kind: 'series'; entry: TmdbSearchSeries } | { kind: 'movie'; entry: TmdbSearchMovie }
  )[] = [
    ...series.map((entry) => ({ kind: 'series' as const, entry })),
    ...movies.map((entry) => ({ kind: 'movie' as const, entry }))
  ]

  return candidates
    .sort((left, right) => byPopularity(left.entry, right.entry))
    .flatMap((candidate) => {
      if (candidate.kind === 'movie') {
        const movie = candidate.entry
        return [
          toResult(
            { kind: 'movie', movieId: movie.id },
            movie.title ?? '',
            movie.original_title,
            movie.release_date,
            'movie',
            movie.id
          )
        ]
      }

      const detail = details.get(candidate.entry.id)
      return detail ? buildSeasonRows(detail) : []
    })
}

/** One row per season, specials included. */
function buildSeasonRows(series: TmdbSeriesDetail): AnimeSearchResult[] {
  const names = readSeriesNames(series)

  return [...(series.seasons ?? [])]
    .sort((left, right) => left.season_number - right.season_number)
    .map((season) =>
      toResult(
        { kind: 'season', seriesId: series.id, seasonNumber: season.season_number },
        composeSeasonEntryName(names.name, season.name, season.season_number),
        names.originalName,
        season.air_date,
        season.season_number === 0 ? 'special' : 'tv',
        series.id
      )
    )
}

/** One row per part of every episode group the show declares. */
function buildEpisodeGroupRows(
  series: TmdbSeriesDetail,
  groups: readonly TmdbEpisodeGroupDetail[]
): AnimeSearchResult[] {
  const names = readSeriesNames(series)

  return groups.flatMap((detail) =>
    readEpisodeGroupItems(detail)
      // A group without an id cannot be named by an entry, so it is not offered.
      .filter((item) => item.id.trim().length > 0)
      .map((item, index) =>
        toResult(
          { kind: 'episodeGroup', seriesId: series.id, setId: detail.id, groupId: item.id },
          composeEpisodeGroupEntryName(
            names.name,
            composeEpisodeGroupPartName(detail, item, index)
          ),
          names.originalName,
          item.episodes?.[0]?.air_date,
          'tv',
          series.id
        )
      )
  )
}

async function loadSeriesDetails(
  client: TmdbClient,
  seriesIds: readonly number[],
  options: TmdbAnimeSearchOptions
): Promise<Map<number, TmdbSeriesDetail>> {
  const details = await mapWithConcurrency(seriesIds, DETAIL_FETCH_CONCURRENCY, (seriesId) =>
    client
      .getSeries(seriesId, { language: options.language, signal: options.signal })
      .catch(recoverMissing)
  )

  return new Map(
    details
      .filter((detail): detail is TmdbSeriesDetail => detail !== null)
      .map((detail) => [detail.id, detail])
  )
}

async function loadEpisodeGroups(
  client: TmdbClient,
  seriesId: number,
  options: TmdbAnimeSearchOptions
): Promise<TmdbEpisodeGroupDetail[]> {
  const request = { language: options.language, signal: options.signal }
  const summaries = await client
    .getEpisodeGroups(seriesId, request)
    .then((response) => response.results ?? [])
    .catch(recoverMissing)

  if (!summaries) {
    return []
  }

  const details = await mapWithConcurrency(
    summaries.slice(0, EXPANDED_EPISODE_GROUP_LIMIT),
    DETAIL_FETCH_CONCURRENCY,
    (summary) => client.getEpisodeGroup(summary.id, request).catch(recoverMissing)
  )

  return details.filter((detail): detail is TmdbEpisodeGroupDetail => detail !== null)
}

function toResult(
  ref: TmdbSubjectRef,
  name: string,
  originalName: string | undefined,
  airDate: string | null | undefined,
  format: LibraryAnimeFormat,
  fallbackId: number
): AnimeSearchResult {
  const id = formatTmdbSubjectId(ref)
  const displayName = trimToUndefined(name) ?? String(fallbackId)

  return {
    id,
    name: displayName,
    originalName: originalName !== displayName ? trimToUndefined(originalName) : undefined,
    releaseDate: parseTmdbDate(airDate),
    format,
    externalIds: [{ source: TMDB_SOURCE_ID, id }]
  }
}

function byPopularity(left: { popularity?: number }, right: { popularity?: number }): number {
  return (right.popularity ?? 0) - (left.popularity ?? 0)
}

/** Enrichment that is absent is data; a cancellation is not. */
function recoverMissing(error: unknown): null {
  if (isCancellationError(error)) {
    throw error
  }

  return null
}
