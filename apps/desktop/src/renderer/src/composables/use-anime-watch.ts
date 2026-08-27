/**
 * Watch state of one anime entry: live playback plus the episode marking paths.
 *
 * The facade bundles the live watching state from the activity store with the
 * watch, stop, and pause/resume transports, so the watch button, episode rows,
 * and the episode detail dialog share one watch path. Without an episode id it
 * reflects any episode of the entry; with one it reflects only that episode.
 * Confirmed outcomes show through the tracked state; only failures notify, and
 * raw transport errors go to the log alone.
 *
 * The marking functions below own every renderer-side write to episode watch
 * state. They set `watched` and never invent a `watchedAt`: a playback time is
 * evidence only the player can produce.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { and, count, eq, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore, type AnimePlaybackState } from '@renderer/stores'
import {
  ANIME_EPISODE_TYPE_VALUES,
  animeEpisodes,
  type AnimeEpisode,
  type AnimeEpisodeType,
  type MediaStatus
} from '@shared/db'
import { useI18n } from './use-i18n'
import { usePlayerControls } from './use-player-controls'

const log = createLogger('Anime')

export interface AnimeWatch {
  isWatching: ComputedRef<boolean>
  playbackStatus: ComputedRef<AnimePlaybackState['status'] | undefined>
  playbackProgress: ComputedRef<{ positionMs: number; durationMs: number | null } | undefined>
  isPaused: ComputedRef<boolean>
  isPauseActionPending: Ref<boolean>
  togglePause: () => Promise<void>
  /** In-flight transport phase, letting buttons render transitional states. */
  pendingAction: Ref<'start' | 'stop' | null>
  isActionPending: ComputedRef<boolean>
  watch: (fileId?: string) => Promise<void>
  stop: () => Promise<void>
}

export function useAnimeWatch(
  animeId: MaybeRefOrGetter<string>,
  episodeId?: MaybeRefOrGetter<string | undefined>
): AnimeWatch {
  const { m } = useI18n()
  const activityStore = useAnimeActivityStore()

  const isWatching = computed(() => {
    const episode = toValue(episodeId)
    return episode
      ? activityStore.isEpisodeWatching(episode)
      : activityStore.isAnimeWatching(toValue(animeId))
  })

  // The entry session may be watching a different episode, so every
  // session-derived value is gated on this facade's own watching scope.
  const playbackStatus = computed(() =>
    isWatching.value ? activityStore.getPlaybackStatus(toValue(animeId)) : undefined
  )
  const playbackProgress = computed(() =>
    isWatching.value ? activityStore.getProgress(toValue(animeId)) : undefined
  )

  const {
    isPaused,
    isPending: isPauseActionPending,
    togglePause
  } = usePlayerControls({
    sessionId: () =>
      isWatching.value ? activityStore.getWatchingStatus(toValue(animeId))?.sessionId : undefined,
    status: () => playbackStatus.value
  })

  const pendingAction = ref<'start' | 'stop' | null>(null)
  const isActionPending = computed(() => pendingAction.value !== null)

  async function watch(fileId?: string): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'start'
    try {
      const result = await ipcManager.invoke(
        'activity:watch-anime',
        toValue(animeId),
        toValue(episodeId),
        fileId
      )
      if (!result.success) {
        notify.error(m.value.activity.watchFailedTitle, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(m.value.activity.watchFailedTitle, m.value.activity.errors[result.data.reason])
      }
    } catch (error) {
      log.error('anime watch call threw:', error)
      notify.error(m.value.activity.watchFailedTitle)
    } finally {
      pendingAction.value = null
    }
  }

  async function stop(): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'stop'
    try {
      const result = await ipcManager.invoke('activity:stop-anime', toValue(animeId))
      if (!result.success) {
        notify.error(m.value.activity.watchStopFailedTitle, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(
          m.value.activity.watchStopFailedTitle,
          m.value.activity.errors[result.data.reason]
        )
      }
    } catch (error) {
      log.error('anime stop call threw:', error)
      notify.error(m.value.activity.watchStopFailedTitle)
    } finally {
      pendingAction.value = null
    }
  }

  return {
    isWatching,
    playbackStatus,
    playbackProgress,
    isPaused,
    isPauseActionPending,
    togglePause,
    pendingAction,
    isActionPending,
    watch,
    stop
  }
}

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
