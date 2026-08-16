/**
 * Watch state of one series entry: live playback plus the episode marking paths.
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
import { and, count, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useTvActivityStore, type TvPlaybackState } from '@renderer/stores'
import { tvEpisodes, tvSeasons, type TvEpisode, type TvStatus } from '@shared/db'
import { useI18n } from './use-i18n'
import { usePlayerControls } from './use-player-controls'

const log = createLogger('Tv')

export interface TvWatch {
  isWatching: ComputedRef<boolean>
  playbackStatus: ComputedRef<TvPlaybackState['status'] | undefined>
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

export function useTvWatch(
  tvId: MaybeRefOrGetter<string>,
  episodeId?: MaybeRefOrGetter<string | undefined>
): TvWatch {
  const { m } = useI18n()
  const activityStore = useTvActivityStore()

  const isWatching = computed(() => {
    const episode = toValue(episodeId)
    return episode
      ? activityStore.isEpisodeWatching(episode)
      : activityStore.isTvWatching(toValue(tvId))
  })

  // The entry session may be watching a different episode, so every
  // session-derived value is gated on this facade's own watching scope.
  const playbackStatus = computed(() =>
    isWatching.value ? activityStore.getPlaybackStatus(toValue(tvId)) : undefined
  )
  const playbackProgress = computed(() =>
    isWatching.value ? activityStore.getProgress(toValue(tvId)) : undefined
  )

  const {
    isPaused,
    isPending: isPauseActionPending,
    togglePause
  } = usePlayerControls({
    sessionId: () =>
      isWatching.value ? activityStore.getWatchingStatus(toValue(tvId))?.sessionId : undefined,
    status: () => playbackStatus.value
  })

  const pendingAction = ref<'start' | 'stop' | null>(null)
  const isActionPending = computed(() => pendingAction.value !== null)

  async function watch(fileId?: string): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'start'
    try {
      const result = await ipcManager.invoke(
        'activity:watch-tv',
        toValue(tvId),
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
      log.error('tv watch call threw:', error)
      notify.error(m.value.activity.watchFailedTitle)
    } finally {
      pendingAction.value = null
    }
  }

  async function stop(): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'stop'
    try {
      const result = await ipcManager.invoke('activity:stop-tv', toValue(tvId))
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
      log.error('tv stop call threw:', error)
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
export async function toggleTvEpisodeWatched(
  episode: Pick<TvEpisode, 'id' | 'watched'>
): Promise<void> {
  const { m } = useI18n()
  try {
    await db
      .update(tvEpisodes)
      .set(
        episode.watched
          ? { watched: false, watchedAt: null }
          : { watched: true, resumePositionMs: null }
      )
      .where(eq(tvEpisodes.id, episode.id))
    notify.success(m.value.tv.episodes.watchedUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

/**
 * Episode grouping the catch-up flow reasons about.
 *
 * A show has no episode type column: season 0 is the industry's own encoding
 * for specials, so the season number carries the distinction.
 */
export type TvEpisodeGroup = 'regular' | 'special'

/** Unwatched episode count per group; zero for groups with nothing pending. */
export type UnwatchedTvEpisodeCounts = Record<TvEpisodeGroup, number>

export async function readUnwatchedTvEpisodeCounts(
  tvId: string
): Promise<UnwatchedTvEpisodeCounts> {
  const rows = await db
    .select({ seasonNumber: tvSeasons.seasonNumber, value: count() })
    .from(tvEpisodes)
    .innerJoin(tvSeasons, eq(tvEpisodes.seasonId, tvSeasons.id))
    .where(and(eq(tvEpisodes.tvId, tvId), eq(tvEpisodes.watched, false)))
    .groupBy(tvSeasons.seasonNumber)

  const counts: UnwatchedTvEpisodeCounts = { regular: 0, special: 0 }
  for (const row of rows) {
    counts[row.seasonNumber === 0 ? 'special' : 'regular'] += row.value
  }
  return counts
}

/**
 * Whether writing this status should offer to catch the entry's episodes up.
 *
 * Only `completed` carries an episode meaning; the remaining statuses say
 * nothing about individual episodes, and no status ever implies unmarking one.
 */
export async function shouldOfferTvWatchCatchUp(tvId: string, status: TvStatus): Promise<boolean> {
  if (status !== 'completed') return false

  const counts = await readUnwatchedTvEpisodeCounts(tvId)
  return counts.regular > 0 || counts.special > 0
}

/**
 * Marks every unwatched episode of the given groups as watched.
 *
 * Already-watched rows are excluded rather than rewritten, so their real
 * playback times and play counts survive and repeating the call is a no-op.
 */
export async function markTvEpisodesWatched(
  tvId: string,
  groups: readonly TvEpisodeGroup[]
): Promise<void> {
  if (groups.length === 0) return

  const specialSeasonIds = db
    .select({ id: tvSeasons.id })
    .from(tvSeasons)
    .where(and(eq(tvSeasons.tvId, tvId), eq(tvSeasons.seasonNumber, 0)))

  const groupCondition =
    groups.length === 2
      ? undefined
      : groups[0] === 'special'
        ? inArray(tvEpisodes.seasonId, specialSeasonIds)
        : notInArray(tvEpisodes.seasonId, specialSeasonIds)

  await db
    .update(tvEpisodes)
    .set({ watched: true, resumePositionMs: null })
    .where(and(eq(tvEpisodes.tvId, tvId), eq(tvEpisodes.watched, false), groupCondition))
}
