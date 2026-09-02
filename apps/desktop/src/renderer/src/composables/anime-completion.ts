/**
 * Anime episode completion: the renderer-side writes to episode watched state,
 * shared by episode rows, the episode detail dialog, and catch-up.
 *
 * `watched` is the state, `watchedAt` the playback evidence: manual marks set
 * the state alone and never invent a `watchedAt`, because a playback time is
 * evidence only the player can produce. Clearing the state also clears the
 * recorded time.
 */

import { and, count, eq, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import {
  ANIME_EPISODE_TYPE_VALUES,
  animeEpisodes,
  type AnimeEpisode,
  type AnimeEpisodeType,
  type MediaStatus
} from '@shared/db'
import { useI18n } from './use-i18n'

/**
 * Flips one episode's watched state.
 *
 * Marking clears the resume point but leaves `watchedAt` alone: a manual mark
 * knows the state without knowing when the episode was played. Unmarking drops
 * the playback time along with the state it proved.
 */
export async function toggleEpisodeWatched(
  episode: Pick<AnimeEpisode, 'id' | 'watched'>
): Promise<void> {
  const { m } = useI18n()
  try {
    await db
      .update(animeEpisodes)
      .set(
        episode.watched
          ? { watched: false, watchedAt: null }
          : { watched: true, resumePositionMs: null }
      )
      .where(eq(animeEpisodes.id, episode.id))
    notify.success(m.value.anime.episodes.watchedUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

/** Unwatched episode count per episode type; zero for types with nothing pending. */
export type UnwatchedEpisodeCounts = Record<AnimeEpisodeType, number>

export async function readUnwatchedEpisodeCounts(animeId: string): Promise<UnwatchedEpisodeCounts> {
  const rows = await db
    .select({ type: animeEpisodes.type, value: count() })
    .from(animeEpisodes)
    .where(and(eq(animeEpisodes.animeId, animeId), eq(animeEpisodes.watched, false)))
    .groupBy(animeEpisodes.type)

  const counts = Object.fromEntries(
    ANIME_EPISODE_TYPE_VALUES.map((type) => [type, 0])
  ) as UnwatchedEpisodeCounts
  for (const row of rows) {
    counts[row.type] = row.value
  }
  return counts
}

/**
 * Whether writing this status should offer to catch the entry's episodes up.
 *
 * Only `completed` carries an episode meaning; the remaining statuses say
 * nothing about individual episodes, and no status ever implies unmarking one.
 */
export async function shouldOfferWatchCatchUp(
  animeId: string,
  status: MediaStatus
): Promise<boolean> {
  if (status !== 'completed') return false

  const counts = await readUnwatchedEpisodeCounts(animeId)
  return ANIME_EPISODE_TYPE_VALUES.some((type) => counts[type] > 0)
}

/**
 * Marks every unwatched episode of the given types as watched.
 *
 * Already-watched rows are excluded rather than rewritten, so their real
 * playback times and play counts survive and repeating the call is a no-op.
 */
export async function markEpisodesWatched(
  animeId: string,
  types: readonly AnimeEpisodeType[]
): Promise<void> {
  await db
    .update(animeEpisodes)
    .set({ watched: true, resumePositionMs: null })
    .where(
      and(
        eq(animeEpisodes.animeId, animeId),
        eq(animeEpisodes.watched, false),
        inArray(animeEpisodes.type, [...types])
      )
    )
}
