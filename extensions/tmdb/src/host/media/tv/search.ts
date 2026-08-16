import type { TvSearchResult } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import type { TmdbSearchSeries, TmdbSeriesDetail } from '../../api/types'
import { readTmdbSeriesRef, type TmdbSeriesRef } from './reference'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import { TMDB_NAME_SEARCH_SHOW_LIMIT, TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import { readTmdbGenreIds, readTmdbTvFormat } from '../format/formats'
import { readSeriesNames } from '../format/names'

export interface TmdbTvSearchOptions {
  language: string
  includeAdult: boolean
  signal: AbortSignal
}

/**
 * TMDB search for series entries.
 *
 * One row per show: a Kisaki series owns its seasons and episodes, so the whole
 * show is the entry and TMDB's slices of it are not offered.
 *
 * A query is read as a reference first, so pasting an id or a themoviedb.org
 * link — of the show or of any season or episode group of it — lands on the
 * show it belongs to. Anything else is a name search.
 */
export async function searchTmdbTv(
  client: TmdbClient,
  query: string,
  options: TmdbTvSearchOptions
): Promise<TvSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const ref = readTmdbSeriesRef(trimmed)

  return ref ? expandReference(client, ref, options) : searchByName(client, trimmed, options)
}

async function expandReference(
  client: TmdbClient,
  ref: TmdbSeriesRef,
  options: TmdbTvSearchOptions
): Promise<TvSearchResult[]> {
  const series = await client.getSeries(ref.seriesId, {
    language: options.language,
    signal: options.signal
  })

  return [toResultFromDetail(series)]
}

async function searchByName(
  client: TmdbClient,
  query: string,
  options: TmdbTvSearchOptions
): Promise<TvSearchResult[]> {
  const page = await client.searchSeries(query, {
    language: options.language,
    includeAdult: options.includeAdult,
    signal: options.signal
  })

  return [...(page.results ?? [])]
    .sort((left, right) => (right.popularity ?? 0) - (left.popularity ?? 0))
    .slice(0, TMDB_NAME_SEARCH_SHOW_LIMIT)
    .map(toResultFromSearchRow)
}

function toResultFromDetail(series: TmdbSeriesDetail): TvSearchResult {
  return toResult(
    { kind: 'series', seriesId: series.id },
    readSeriesNames(series),
    series.first_air_date,
    readTmdbTvFormat(series.type, readTmdbGenreIds(series.genres))
  )
}

function toResultFromSearchRow(series: TmdbSearchSeries): TvSearchResult {
  return toResult(
    { kind: 'series', seriesId: series.id },
    readSeriesNames(series),
    series.first_air_date,
    // A search row states no show kind, so its genres answer for it.
    readTmdbTvFormat(undefined, series.genre_ids ?? [])
  )
}

function toResult(
  ref: TmdbSeriesRef,
  names: { name: string; originalName?: string },
  firstAirDate: string | null | undefined,
  format: TvSearchResult['format']
): TvSearchResult {
  const id = formatTmdbSubjectId(ref)

  return omitUndefined({
    id,
    name: names.name,
    originalName: names.originalName,
    releaseDate: parseTmdbDate(firstAirDate),
    format,
    externalIds: [{ source: TMDB_SOURCE_ID, id }]
  })
}
