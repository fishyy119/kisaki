import type { LibraryAnimeEpisodeType, ScrapedAnimeEpisode } from '@kisaki3/extension-sdk'
import type { TmdbEpisode } from '../../api/types'
import type { TmdbEpisodeGroupRef, TmdbSeasonRef } from '../../identity/subject-id'
import type { TmdbMovieLoaders, TmdbSeriesLoaders } from '../loaders'
import { mapWithConcurrency } from '../../utils/object'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { parseTmdbDate, toDurationMs } from '../format/dates'
import { buildImageUrl } from '../format/images'
import { readMovieNames } from '../format/names'
import { trimToUndefined } from '../format/text'
import { findEpisodeGroupItem } from './episode-groups'

const SEASON_FETCH_CONCURRENCY = 4

/**
 * A film as the single episode of its entry.
 *
 * TMDB has no episode entity for a film, so this row carries no external id
 * and re-scrapes realign it by kind and number like any source-less episode.
 */
export async function buildMovieEpisodes(
  loaders: TmdbMovieLoaders
): Promise<ScrapedAnimeEpisode[]> {
  const movie = await loaders.getMovie()

  return [
    {
      number: 1,
      type: 'regular' as const,
      name: readMovieNames(movie).name,
      airDate: parseTmdbDate(movie.release_date),
      description: trimToUndefined(movie.overview),
      durationMs: toDurationMs(movie.runtime)
    }
  ]
}

/**
 * Every season of a show as one flat list.
 *
 * Broadcast seasons are renumbered into a single absolute run in season order,
 * because the entry is the show as a whole; the specials season keeps TMDB's
 * own numbering and is marked as such.
 */
export async function buildSeriesEpisodes(
  loaders: TmdbSeriesLoaders,
  imageBaseUrl: string
): Promise<ScrapedAnimeEpisode[]> {
  const series = await loaders.getSeries()
  const seasonNumbers = [...(series.seasons ?? [])]
    .map((season) => season.season_number)
    .sort((left, right) => left - right)

  const seasons = await mapWithConcurrency(
    seasonNumbers,
    SEASON_FETCH_CONCURRENCY,
    (seasonNumber) => loaders.getSeason(seasonNumber)
  )

  const specials: ScrapedAnimeEpisode[] = []
  const regular: ScrapedAnimeEpisode[] = []

  for (const season of seasons) {
    for (const episode of season.episodes ?? []) {
      if (season.season_number === 0) {
        specials.push(
          toEpisode(episode, episode.episode_number ?? specials.length + 1, 'special', imageBaseUrl)
        )
        continue
      }

      regular.push(toEpisode(episode, regular.length + 1, 'regular', imageBaseUrl))
    }
  }

  return [...regular, ...specials]
}

export async function buildSeasonEpisodes(
  ref: TmdbSeasonRef,
  loaders: TmdbSeriesLoaders,
  imageBaseUrl: string
): Promise<ScrapedAnimeEpisode[]> {
  const season = await loaders.getSeason(ref.seasonNumber)
  const type: LibraryAnimeEpisodeType = ref.seasonNumber === 0 ? 'special' : 'regular'

  return (season.episodes ?? []).map((episode, index) =>
    toEpisode(episode, episode.episode_number ?? index + 1, type, imageBaseUrl)
  )
}

/**
 * One part of an episode group as a contiguous run.
 *
 * An episode group *is* an ordering, so position in the group is the episode
 * number and every entry in it counts as a regular episode, whichever season
 * TMDB files the episode under.
 */
export async function buildEpisodeGroupEpisodes(
  ref: TmdbEpisodeGroupRef,
  loaders: TmdbSeriesLoaders,
  imageBaseUrl: string
): Promise<ScrapedAnimeEpisode[]> {
  const detail = await loaders.getEpisodeGroup(ref.setId)
  const { item } = findEpisodeGroupItem(detail, ref.groupId)
  const episodes = [...(item.episodes ?? [])].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0)
  )

  return episodes.map((episode, index) => toEpisode(episode, index + 1, 'regular', imageBaseUrl))
}

function toEpisode(
  episode: TmdbEpisode,
  number: number,
  type: LibraryAnimeEpisodeType,
  imageBaseUrl: string
): ScrapedAnimeEpisode {
  return {
    number,
    type,
    name: trimToUndefined(episode.name),
    airDate: parseTmdbDate(episode.air_date),
    description: trimToUndefined(episode.overview),
    durationMs: toDurationMs(episode.runtime),
    stillUrl: buildImageUrl(imageBaseUrl, episode.still_path),
    // The episode id is stable across every ordering of the same show, so
    // switching between aired order and an episode group renumbers rows
    // instead of replacing them, and watch state survives.
    externalIds: [{ source: TMDB_SOURCE_ID, id: String(episode.id) }]
  }
}
