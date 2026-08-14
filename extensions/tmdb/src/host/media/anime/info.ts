import { isCancellationError, type ScrapedAnimeInfo } from '@kisaki3/extension-sdk'
import type { TmdbExternalIds } from '../../api/types'
import type { TmdbEpisodeGroupRef, TmdbSeasonRef, TmdbSeriesRef } from '../../identity/subject-id'
import type { TmdbMovieLoaders, TmdbSeriesLoaders } from '../loaders'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import {
  composeEpisodeGroupEntryName,
  composeSeasonEntryName,
  readMovieNames,
  readSeriesNames
} from '../format/names'
import {
  buildExternalSites,
  homepageSite,
  imdbTitleSite,
  tmdbEpisodeGroupUrl,
  tmdbMovieUrl,
  tmdbSeasonUrl,
  tmdbSeriesUrl,
  tmdbSite
} from '../format/sites'
import { trimToUndefined } from '../format/text'
import { composeEpisodeGroupPartName, findEpisodeGroupItem } from './episode-groups'

export async function buildMovieInfo(loaders: TmdbMovieLoaders): Promise<ScrapedAnimeInfo> {
  const movie = await loaders.getMovie()
  const names = readMovieNames(movie)

  return omitUndefined({
    ...names,
    releaseDate: parseTmdbDate(movie.release_date),
    description: trimToUndefined(movie.overview),
    format: 'movie' as const,
    totalEpisodes: 1,
    externalSites: buildExternalSites([
      tmdbSite(tmdbMovieUrl(movie.id)),
      imdbTitleSite(movie.imdb_id),
      homepageSite(movie.homepage)
    ])
  })
}

export async function buildSeriesInfo(
  ref: TmdbSeriesRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedAnimeInfo> {
  const [series, externalIds] = await Promise.all([
    loaders.getSeries(),
    loaders.getExternalIds().catch(recoverEmptyIds)
  ])

  return omitUndefined({
    ...readSeriesNames(series),
    releaseDate: parseTmdbDate(series.first_air_date),
    description: trimToUndefined(series.overview),
    format: 'tv' as const,
    totalEpisodes: readPositiveInteger(series.number_of_episodes),
    externalSites: buildExternalSites([
      tmdbSite(tmdbSeriesUrl(ref.seriesId)),
      imdbTitleSite(externalIds.imdb_id),
      homepageSite(series.homepage)
    ])
  })
}

export async function buildSeasonInfo(
  ref: TmdbSeasonRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedAnimeInfo> {
  const [series, season] = await Promise.all([
    loaders.getSeries(),
    loaders.getSeason(ref.seasonNumber)
  ])
  const names = readSeriesNames(series)

  return omitUndefined({
    name: composeSeasonEntryName(names.name, season.name, ref.seasonNumber),
    originalName: names.originalName,
    releaseDate: parseTmdbDate(season.air_date ?? series.first_air_date),
    description: trimToUndefined(season.overview) ?? trimToUndefined(series.overview),
    // A specials season is a bundle of extras, not a broadcast run of its own.
    format: ref.seasonNumber === 0 ? ('special' as const) : ('tv' as const),
    totalEpisodes: readPositiveInteger(season.episodes?.length),
    externalSites: buildExternalSites([
      tmdbSite(tmdbSeasonUrl(ref.seriesId, ref.seasonNumber)),
      homepageSite(series.homepage)
    ])
  })
}

export async function buildEpisodeGroupInfo(
  ref: TmdbEpisodeGroupRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedAnimeInfo> {
  const [series, detail] = await Promise.all([
    loaders.getSeries(),
    loaders.getEpisodeGroup(ref.setId)
  ])
  const { item, index } = findEpisodeGroupItem(detail, ref.groupId)
  const names = readSeriesNames(series)

  return omitUndefined({
    name: composeEpisodeGroupEntryName(
      names.name,
      composeEpisodeGroupPartName(detail, item, index)
    ),
    originalName: names.originalName,
    releaseDate: parseTmdbDate(item.episodes?.[0]?.air_date),
    description: trimToUndefined(detail.description) ?? trimToUndefined(series.overview),
    format: 'tv' as const,
    totalEpisodes: readPositiveInteger(item.episodes?.length),
    externalSites: buildExternalSites([
      tmdbSite(tmdbEpisodeGroupUrl(ref.seriesId, ref.setId, ref.groupId)),
      homepageSite(series.homepage)
    ])
  })
}

function readPositiveInteger(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/** An unreadable id table only costs a link; a cancellation is not absence. */
function recoverEmptyIds(error: unknown): TmdbExternalIds {
  if (isCancellationError(error)) {
    throw error
  }

  return {}
}
