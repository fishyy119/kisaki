import { isCancellationError, type ScrapedAnimeInfo } from '@kisaki3/extension-sdk'
import type { TmdbAlternativeTitle, TmdbExternalIds } from '../../api/types'
import type { TmdbEpisodeGroupRef, TmdbSeasonRef, TmdbSeriesRef } from '../../identity/subject-id'
import type { TmdbMovieLoaders, TmdbSeriesLoaders } from '../loaders'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import {
  composeEpisodeGroupEntryName,
  composeSeasonEntryName,
  readAlternativeTitles,
  readMovieNames,
  readSeriesNames,
  type TmdbAliasOptions
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

export async function buildMovieInfo(
  loaders: TmdbMovieLoaders,
  titleCountries: readonly string[]
): Promise<ScrapedAnimeInfo> {
  const [movie, alternativeTitles] = await Promise.all([
    loaders.getMovie(),
    loaders.getAlternativeTitles().catch(recoverEmptyTitles)
  ])
  const names = readMovieNames(movie)

  return omitUndefined({
    ...names,
    aliases: toAliases(alternativeTitles, {
      localCountries: titleCountries,
      exclude: [names.name, names.originalName]
    }),
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
  loaders: TmdbSeriesLoaders,
  titleCountries: readonly string[]
): Promise<ScrapedAnimeInfo> {
  const [series, externalIds, alternativeTitles] = await Promise.all([
    loaders.getSeries(),
    loaders.getExternalIds().catch(recoverEmptyIds),
    loaders.getAlternativeTitles().catch(recoverEmptyTitles)
  ])
  const names = readSeriesNames(series)

  return omitUndefined({
    ...names,
    aliases: toAliases(alternativeTitles, {
      localCountries: titleCountries,
      exclude: [names.name, names.originalName]
    }),
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
  loaders: TmdbSeriesLoaders,
  titleCountries: readonly string[]
): Promise<ScrapedAnimeInfo> {
  const [series, season, nativeSeason, alternativeTitles] = await Promise.all([
    loaders.getSeries(),
    loaders.getSeason(ref.seasonNumber),
    loaders.getNativeSeason(ref.seasonNumber).catch(recoverNoSeason),
    loaders.getAlternativeTitles().catch(recoverEmptyTitles)
  ])
  const names = readSeriesNames(series)
  const entryName = composeSeasonEntryName(names.name, season.name, ref.seasonNumber)
  const originalName = composeNativeSeasonName(
    names.originalName,
    nativeSeason?.name,
    ref.seasonNumber
  )

  return omitUndefined({
    name: entryName,
    originalName,
    // TMDB titles the show, not the season, so the show's other titles are the
    // names this entry is also known by; a title marked for another season is
    // the one thing that is not.
    aliases: toAliases(alternativeTitles, {
      localCountries: titleCountries,
      exclude: [entryName, originalName, names.originalName, names.name],
      seasonNumber: ref.seasonNumber
    }),
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

/**
 * An episode group entry.
 *
 * Unlike a season, an episode group has no native title to compose from: TMDB
 * returns group names verbatim in every language, because they are labels a
 * contributor typed rather than a translated resource. The show's original name
 * therefore stands alone, and splicing a group label into it would state a
 * title in whichever language that label happens to be written in.
 */
export async function buildEpisodeGroupInfo(
  ref: TmdbEpisodeGroupRef,
  loaders: TmdbSeriesLoaders,
  titleCountries: readonly string[]
): Promise<ScrapedAnimeInfo> {
  const [series, detail, alternativeTitles] = await Promise.all([
    loaders.getSeries(),
    loaders.getEpisodeGroup(ref.setId),
    loaders.getAlternativeTitles().catch(recoverEmptyTitles)
  ])
  const { item, index } = findEpisodeGroupItem(detail, ref.groupId)
  const names = readSeriesNames(series)
  const entryName = composeEpisodeGroupEntryName(
    names.name,
    composeEpisodeGroupPartName(detail, item, index)
  )

  return omitUndefined({
    name: entryName,
    originalName: names.originalName,
    aliases: toAliases(alternativeTitles, {
      localCountries: titleCountries,
      exclude: [entryName, names.originalName, names.name]
    }),
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

/**
 * Aliases, or absent when TMDB stated none.
 *
 * An empty list would claim the entry authoritatively has no other titles,
 * which would let `replace` clear names another source contributed.
 */
function toAliases(
  titles: readonly TmdbAlternativeTitle[],
  options: TmdbAliasOptions
): string[] | undefined {
  const aliases = readAlternativeTitles(titles, options)
  return aliases.length > 0 ? aliases : undefined
}

/**
 * The season's own title in the show's language, qualified by the show as
 * `name` is, so the two name fields describe the same slice.
 *
 * Without a show original name — or when the native read failed — the show
 * level name stands rather than a composed guess.
 */
function composeNativeSeasonName(
  seriesOriginalName: string | undefined,
  nativeSeasonName: string | null | undefined,
  seasonNumber: number
): string | undefined {
  if (!seriesOriginalName) return undefined
  if (!trimToUndefined(nativeSeasonName)) return seriesOriginalName

  return composeSeasonEntryName(seriesOriginalName, nativeSeasonName, seasonNumber)
}

/** An unreadable id table only costs a link; a cancellation is not absence. */
function recoverEmptyIds(error: unknown): TmdbExternalIds {
  if (isCancellationError(error)) {
    throw error
  }

  return {}
}

/** An unreadable title list only costs aliases; a cancellation is not absence. */
function recoverEmptyTitles(error: unknown): TmdbAlternativeTitle[] {
  if (isCancellationError(error)) {
    throw error
  }

  return []
}

/** An unreadable native season only costs the qualifier on the original name. */
function recoverNoSeason(error: unknown): undefined {
  if (isCancellationError(error)) {
    throw error
  }

  return undefined
}
