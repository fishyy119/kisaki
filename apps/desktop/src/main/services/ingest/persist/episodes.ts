/** Anime episode row persistence shared by the first-write and re-scrape flows. */

import { newId } from '@shared/id'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import { animeEpisodeExternalIds, animeEpisodes } from '@shared/db'
import type { AnimeEpisodeInfo } from '@shared/metadata'
import type { DbContext } from '@main/services/db'

/**
 * Attach external ids to an episode row.
 *
 * Conflicts are skipped rather than reassigned: an id already claimed by
 * another episode stays there, mirroring how entity external ids behave.
 */
export function insertAnimeEpisodeExternalIds(
  tx: DbContext,
  episodeId: string,
  externalIds: ExternalId[] | undefined,
  startOrder = 0
): void {
  for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
    tx.insert(animeEpisodeExternalIds)
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

/** Insert one scraped episode row together with its identity, returning its id. */
export function insertAnimeEpisodeRow(
  tx: DbContext,
  animeId: string,
  episode: AnimeEpisodeInfo,
  orderInAnime: number
): string {
  const episodeId = newId()
  tx.insert(animeEpisodes)
    .values({
      id: episodeId,
      animeId,
      type: episode.type,
      episodeNumber: episode.number,
      name: episode.name,
      originalName: episode.originalName,
      airDate: episode.airDate,
      description: episode.description,
      durationMs: episode.durationMs,
      orderInAnime
    })
    .run()

  insertAnimeEpisodeExternalIds(tx, episodeId, episode.externalIds)
  return episodeId
}
