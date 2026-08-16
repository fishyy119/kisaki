import type { ScrapedTvEpisode, ScrapedTvSeason } from '@kisaki3/extension-sdk'
import type { TmdbEpisode, TmdbSeasonDetail, TmdbSeasonSummary } from '../../api/types'
import type { TmdbSeriesLoaders } from '../loaders'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { mapWithConcurrency, omitUndefined } from '../../utils/object'
import { parseTmdbDate, toDurationMs } from '../format/dates'
import { trimToUndefined } from '../format/text'

const SEASON_FETCH_CONCURRENCY = 4

/**
 * Seasons of a show, in TMDB's own numbering.
 *
 * The season summaries on the series detail already carry everything the
 * library stores about a season, so no season is fetched for this slot.
 */
export async function buildTvSeasons(loaders: TmdbSeriesLoaders): Promise<ScrapedTvSeason[]> {
  const series = await loaders.getSeries()

  return orderedSeasonSummaries(series.seasons).map((season) =>
    omitUndefined({
      number: season.season_number,
      name: trimToUndefined(season.name),
      airDate: parseTmdbDate(season.air_date),
      description: trimToUndefined(season.overview),
      totalEpisodes: readPositiveInteger(season.episode_count)
    })
  )
}

/**
 * Every episode of a show, each keeping the season and number TMDB gives it.
 *
 * A tv entry mirrors the broadcast structure rather than flattening it, so
 * specials stay the episodes of season 0 and no renumbering happens here.
 */
export async function buildTvEpisodes(loaders: TmdbSeriesLoaders): Promise<ScrapedTvEpisode[]> {
  const series = await loaders.getSeries()
  const seasonNumbers = orderedSeasonSummaries(series.seasons).map((season) => season.season_number)

  const seasons = await mapWithConcurrency(
    seasonNumbers,
    SEASON_FETCH_CONCURRENCY,
    (seasonNumber) => loaders.getSeason(seasonNumber)
  )

  return seasons.flatMap((season, index) =>
    (season.episodes ?? []).map((episode, position) =>
      toEpisode(episode, readSeasonNumber(season, seasonNumbers[index]!), position)
    )
  )
}

function toEpisode(episode: TmdbEpisode, seasonNumber: number, position: number): ScrapedTvEpisode {
  return omitUndefined({
    seasonNumber,
    number: episode.episode_number ?? position + 1,
    name: trimToUndefined(episode.name),
    airDate: parseTmdbDate(episode.air_date),
    description: trimToUndefined(episode.overview),
    durationMs: toDurationMs(episode.runtime),
    // The episode id is stable even when TMDB revises a number, so a re-scrape
    // realigns existing rows instead of replacing them and watch state survives.
    externalIds: [{ source: TMDB_SOURCE_ID, id: String(episode.id) }]
  })
}

/** The requested number stands in when a season detail omits its own. */
function readSeasonNumber(season: TmdbSeasonDetail, requested: number): number {
  return season.season_number ?? requested
}

function orderedSeasonSummaries(
  seasons: readonly TmdbSeasonSummary[] | undefined
): TmdbSeasonSummary[] {
  return [...(seasons ?? [])].sort((left, right) => left.season_number - right.season_number)
}

function readPositiveInteger(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}
