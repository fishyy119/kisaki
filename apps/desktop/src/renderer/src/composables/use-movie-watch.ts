/**
 * Watch state of one movie entry: live playback plus the watched marking path.
 *
 * A movie has no episode grain, so its watch state lives on the entry row: the
 * facade bundles the live watching state from the activity store with the
 * watch, stop, and pause/resume transports, and the marking helper below owns
 * every renderer-side write to that state. Confirmed outcomes show through the
 * tracked state; only failures notify, and raw transport errors go to the log
 * alone.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useMovieActivityStore, type MoviePlaybackState } from '@renderer/stores'
import { movies, type Movie } from '@shared/db'
import { useI18n } from './use-i18n'
import { usePlayerControls } from './use-player-controls'

const log = createLogger('Movie')

export interface MovieWatch {
  isWatching: ComputedRef<boolean>
  playbackStatus: ComputedRef<MoviePlaybackState['status'] | undefined>
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

export function useMovieWatch(movieId: MaybeRefOrGetter<string>): MovieWatch {
  const { m } = useI18n()
  const activityStore = useMovieActivityStore()

  const isWatching = computed(() => activityStore.isMovieWatching(toValue(movieId)))

  const playbackStatus = computed(() =>
    isWatching.value ? activityStore.getPlaybackStatus(toValue(movieId)) : undefined
  )
  const playbackProgress = computed(() =>
    isWatching.value ? activityStore.getProgress(toValue(movieId)) : undefined
  )

  const {
    isPaused,
    isPending: isPauseActionPending,
    togglePause
  } = usePlayerControls({
    sessionId: () =>
      isWatching.value ? activityStore.getWatchingStatus(toValue(movieId))?.sessionId : undefined,
    status: () => playbackStatus.value
  })

  const pendingAction = ref<'start' | 'stop' | null>(null)
  const isActionPending = computed(() => pendingAction.value !== null)

  async function watch(fileId?: string): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'start'
    try {
      const result = await ipcManager.invoke('activity:watch-movie', toValue(movieId), fileId)
      if (!result.success) {
        notify.error(m.value.activity.watchFailedTitle, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(m.value.activity.watchFailedTitle, m.value.activity.errors[result.data.reason])
      }
    } catch (error) {
      log.error('movie watch call threw:', error)
      notify.error(m.value.activity.watchFailedTitle)
    } finally {
      pendingAction.value = null
    }
  }

  async function stop(): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'stop'
    try {
      const result = await ipcManager.invoke('activity:stop-movie', toValue(movieId))
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
      log.error('movie stop call threw:', error)
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
 * Flips the entry's watched state.
 *
 * Marking clears the resume point but leaves `watchedAt` alone: a manual mark
 * knows the state without knowing when the movie was played. Unmarking drops
 * the playback time along with the state it proved.
 */
export async function toggleMovieWatched(movie: Pick<Movie, 'id' | 'watched'>): Promise<void> {
  const { m } = useI18n()
  try {
    await db
      .update(movies)
      .set(
        movie.watched
          ? { watched: false, watchedAt: null }
          : { watched: true, resumePositionMs: null }
      )
      .where(eq(movies.id, movie.id))
    notify.success(m.value.movie.watch.watchedUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

/** Drops the resume point without touching the watched state it belongs to. */
export async function clearMovieResumePosition(movieId: string): Promise<void> {
  const { m } = useI18n()
  try {
    await db.update(movies).set({ resumePositionMs: null }).where(eq(movies.id, movieId))
    notify.success(m.value.movie.watch.resumeCleared)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}
