/**
 * Playback facade for one anime extra.
 *
 * Bundles the live playing state from the activity store with the play, stop,
 * and pause/resume transports, so the extra row and the extra detail dialog
 * share one playback path. Extras carry no watch state; sessions are tracked
 * for live UI only.
 */

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAnimeActivityStore, type AnimePlaybackState } from '@renderer/stores'
import { useI18n } from './use-i18n'
import { usePlayerControls } from './use-player-controls'

const log = createLogger('Anime')

export interface AnimeExtraPlayback {
  isPlaying: ComputedRef<boolean>
  playbackStatus: ComputedRef<AnimePlaybackState['status'] | undefined>
  playbackProgress: ComputedRef<{ positionMs: number; durationMs: number | null } | undefined>
  isPaused: Ref<boolean>
  isPauseActionPending: Ref<boolean>
  togglePause: () => Promise<void>
  isActionPending: Ref<boolean>
  play: (fileId?: string) => Promise<void>
  stop: () => Promise<void>
}

export function useAnimeExtraPlayback(extraId: MaybeRefOrGetter<string>): AnimeExtraPlayback {
  const { m } = useI18n()
  const activityStore = useAnimeActivityStore()

  const isPlaying = computed(() => activityStore.isExtraPlaying(toValue(extraId)))
  const playbackStatus = computed(() =>
    isPlaying.value ? activityStore.getExtraPlaybackStatus(toValue(extraId)) : undefined
  )
  const playbackProgress = computed(() =>
    isPlaying.value ? activityStore.getExtraProgress(toValue(extraId)) : undefined
  )

  const {
    isPaused,
    isPending: isPauseActionPending,
    togglePause
  } = usePlayerControls({
    sessionId: () => activityStore.getExtraPlayingStatus(toValue(extraId))?.sessionId,
    status: () => playbackStatus.value
  })

  const isActionPending = ref(false)

  async function play(fileId?: string): Promise<void> {
    if (isActionPending.value) return

    isActionPending.value = true
    try {
      const result = await ipcManager.invoke('activity:play-anime-extra', toValue(extraId), fileId)
      if (!result.success) {
        notify.error(m.value.anime.extras.playFailed, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(m.value.anime.extras.playFailed, m.value.activity.errors[result.data.reason])
      }
    } catch (error) {
      log.error('extra playback call threw:', error)
      notify.error(m.value.anime.extras.playFailed)
    } finally {
      isActionPending.value = false
    }
  }

  async function stop(): Promise<void> {
    if (isActionPending.value) return

    isActionPending.value = true
    try {
      const result = await ipcManager.invoke('activity:stop-anime-extra', toValue(extraId))
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
      log.error('extra stop call threw:', error)
      notify.error(m.value.activity.watchStopFailedTitle)
    } finally {
      isActionPending.value = false
    }
  }

  return {
    isPlaying,
    playbackStatus,
    playbackProgress,
    isPaused,
    isPauseActionPending,
    togglePause,
    isActionPending,
    play,
    stop
  }
}
