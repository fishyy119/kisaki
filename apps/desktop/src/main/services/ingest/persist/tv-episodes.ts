/** TV season and episode row persistence shared by the first-write and re-scrape flows. */

import { nanoid } from 'nanoid'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import { tvEpisodeExternalIds, tvEpisodes, tvSeasons } from '@shared/db'
import type { TvEpisodeInfo, TvSeasonInfo } from '@shared/metadata'
import type { DbContext } from '@main/services/db'

/**
 * Attach external ids to an episode row.
 *
 * Conflicts are skipped rather than reassigned: an id already claimed by
 * another episode stays there, mirroring how entity external ids behave.
 */
export function insertTvEpisodeExternalIds(
  tx: DbContext,
  episodeId: string,
  externalIds: ExternalId[] | undefined,
  startOrder = 0
): void {
  for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
    tx.insert(tvEpisodeExternalIds)
      .values({
        episodeId,
        source: extId.source,
        externalId: extId.id,
        orderInEpisode: startOrder + index
      })
      .onConflictDoNothing()
      .run()
  }
}

/** Insert one scraped season row, returning its id. */
export function insertTvSeasonRow(
  tx: DbContext,
  tvId: string,
  season: TvSeasonInfo,
  orderInTv: number
): string {
  const seasonId = nanoid()
  tx.insert(tvSeasons)
    .values({
      id: seasonId,
      tvId,
      seasonNumber: season.number,
      name: season.name,
      originalName: season.originalName,
      airDate: season.airDate,
      description: season.description,
      totalEpisodes: season.totalEpisodes,
      orderInTv
    })
    .run()

  return seasonId
}

/** Insert one scraped episode row together with its identity, returning its id. */
export function insertTvEpisodeRow(
  tx: DbContext,
  params: {
    tvId: string
    seasonId: string
    episode: TvEpisodeInfo
    orderInSeason: number
    orderInTv: number
  }
): string {
  const { tvId, seasonId, episode, orderInSeason, orderInTv } = params

  const episodeId = nanoid()
  tx.insert(tvEpisodes)
    .values({
      id: episodeId,
      tvId,
      seasonId,
      episodeNumber: episode.number,
      name: episode.name,
      originalName: episode.originalName,
      airDate: episode.airDate,
      description: episode.description,
      durationMs: episode.durationMs,
      orderInSeason,
      orderInTv
    })
    .run()

  insertTvEpisodeExternalIds(tx, episodeId, episode.externalIds)
  return episodeId
}

/**
 * Write a show's seasons and episodes.
 *
 * Episodes address their season by number, so the season rows go in first and
 * hand back the ids the episode rows need. Episodes naming a season the list
 * never stated are dropped: the graph builder already turns implied seasons
 * into rows, so a leftover here is a provider inconsistency.
 */
export function insertTvSeasonsAndEpisodes(
  tx: DbContext,
  tvId: string,
  seasons: TvSeasonInfo[] | undefined,
  episodes: TvEpisodeInfo[] | undefined
): void {
  const seasonIdByNumber = new Map<number, string>()
  for (const [index, season] of (seasons ?? []).entries()) {
    seasonIdByNumber.set(season.number, insertTvSeasonRow(tx, tvId, season, index))
  }

  const orderInSeasonCounters = new Map<number, number>()
  let orderInTv = 0
  for (const episode of episodes ?? []) {
    const seasonId = seasonIdByNumber.get(episode.seasonNumber)
    if (!seasonId) continue

    const orderInSeason = orderInSeasonCounters.get(episode.seasonNumber) ?? 0
    orderInSeasonCounters.set(episode.seasonNumber, orderInSeason + 1)

    insertTvEpisodeRow(tx, {
      tvId,
      seasonId,
      episode,
      orderInSeason,
      orderInTv: orderInTv++
    })
  }
}
