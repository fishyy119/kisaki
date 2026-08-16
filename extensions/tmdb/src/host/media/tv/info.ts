import { isCancellationError, type ScrapedTvInfo } from '@kisaki3/extension-sdk'
import type { TmdbExternalIds } from '../../api/types'
import type { TmdbSeriesLoaders } from '../loaders'
import { omitUndefined } from '../../utils/object'
import { parseTmdbDate } from '../format/dates'
import { readTmdbGenreIds, readTmdbTvFormat } from '../format/formats'
import { readSeriesNames } from '../format/names'
import {
  buildExternalSites,
  homepageSite,
  imdbTitleSite,
  tmdbSeriesUrl,
  tmdbSite
} from '../format/sites'
import { trimToUndefined } from '../format/text'
import type { TmdbSeriesRef } from './reference'

/**
 * Show-level facts.
 *
 * `last_air_date` is TMDB's most recent episode rather than a stated ending, so
 * it only becomes an end date once the show has stopped: while a show runs it
 * would read as if the library already knew when it finished.
 */
export async function buildTvInfo(
  ref: TmdbSeriesRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedTvInfo> {
  const [series, externalIds] = await Promise.all([
    loaders.getSeries(),
    loaders.getExternalIds().catch(recoverEmptyIds)
  ])

  return omitUndefined({
    ...readSeriesNames(series),
    releaseDate: parseTmdbDate(series.first_air_date),
    endDate: hasEnded(series.status) ? parseTmdbDate(series.last_air_date) : undefined,
    description: trimToUndefined(series.overview),
    format: readTmdbTvFormat(series.type, readTmdbGenreIds(series.genres)),
    totalSeasons: readPositiveInteger(series.number_of_seasons),
    totalEpisodes: readPositiveInteger(series.number_of_episodes),
    externalSites: buildExternalSites([
      tmdbSite(tmdbSeriesUrl(ref.seriesId)),
      imdbTitleSite(externalIds.imdb_id),
      homepageSite(series.homepage)
    ])
  })
}

/** TMDB states `Returning Series`, `Ended`, `Canceled`, `In Production`, and so on. */
function hasEnded(status: string | undefined): boolean {
  const normalized = status?.trim().toLowerCase()
  return normalized === 'ended' || normalized === 'canceled' || normalized === 'cancelled'
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
