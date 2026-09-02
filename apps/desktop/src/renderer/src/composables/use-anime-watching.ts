/**
 * Watching state of one anime entry: live playback plus the watch, stop, and
 * pause/resume transports, so the watch button, episode rows, and the episode
 * detail dialog share one watch path. Without an episode id the live state
 * reflects any episode of the entry; with one it reflects only that episode.
 * Confirmed outcomes show through the tracked state; only failures notify, and
 * raw transport errors go to the log alone.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore, type AnimePlaybackState } from '@renderer/stores'
import { useI18n } from './use-i18n'
import { usePlayerControls } from './use-player-controls'

const log = createLogger('Library')

export interface AnimeWatching {
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

export function useAnimeWatching(
  animeId: MaybeRefOrGetter<string>,
  episodeId?: MaybeRefOrGetter<string | undefined>
): AnimeWatching {
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
