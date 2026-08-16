import type { MovieSearchResult } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import type { TmdbMovieDetail, TmdbSearchMovie } from '../../api/types'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import { TMDB_NAME_SEARCH_MOVIE_LIMIT, TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import { readTmdbGenreIds, readTmdbMovieFormat } from '../format/formats'
import { readMovieNames } from '../format/names'
import { readTmdbMovieRef, type TmdbMovieRef } from './reference'

export interface TmdbMovieSearchOptions {
  language: string
  includeAdult: boolean
  signal: AbortSignal
}

/**
 * TMDB search for film entries.
 *
 * A query is read as a reference first, so pasting an id or a themoviedb.org
 * link lands on the film it names. Anything else is a name search.
 */
export async function searchTmdbMovie(
  client: TmdbClient,
  query: string,
  options: TmdbMovieSearchOptions
): Promise<MovieSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const ref = readTmdbMovieRef(trimmed)

  return ref ? expandReference(client, ref, options) : searchByName(client, trimmed, options)
}

async function expandReference(
  client: TmdbClient,
  ref: TmdbMovieRef,
  options: TmdbMovieSearchOptions
): Promise<MovieSearchResult[]> {
  const movie = await client.getMovie(ref.movieId, {
    language: options.language,
    signal: options.signal
  })

  return [toResultFromDetail(movie)]
}

async function searchByName(
  client: TmdbClient,
  query: string,
  options: TmdbMovieSearchOptions
): Promise<MovieSearchResult[]> {
  const page = await client.searchMovies(query, {
    language: options.language,
    includeAdult: options.includeAdult,
    signal: options.signal
  })

  return [...(page.results ?? [])]
    .sort((left, right) => (right.popularity ?? 0) - (left.popularity ?? 0))
    .slice(0, TMDB_NAME_SEARCH_MOVIE_LIMIT)
    .map(toResultFromSearchRow)
}

function toResultFromDetail(movie: TmdbMovieDetail): MovieSearchResult {
  return toResult(
    movie.id,
    readMovieNames(movie),
    movie.release_date,
    readTmdbMovieFormat(readTmdbGenreIds(movie.genres), movie.runtime)
  )
}

function toResultFromSearchRow(movie: TmdbSearchMovie): MovieSearchResult {
  return toResult(
    movie.id,
    readMovieNames(movie),
    movie.release_date,
    // A search row states no runtime, so a short reads as a feature until the
    // entry is scraped.
    readTmdbMovieFormat(movie.genre_ids ?? [])
  )
}

function toResult(
  movieId: number,
  names: { name: string; originalName?: string },
  releaseDate: string | null | undefined,
  format: MovieSearchResult['format']
): MovieSearchResult {
  const id = formatTmdbSubjectId({ kind: 'movie', movieId })

  return omitUndefined({
    id,
    name: names.name,
    originalName: names.originalName,
    releaseDate: parseTmdbDate(releaseDate),
    format,
    externalIds: [{ source: TMDB_SOURCE_ID, id }]
  })
}
