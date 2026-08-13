/**
 * Playback facade for one anime extra.
 *
 * Bundles the live playing state from the activity store with the play, stop,
 * and pause/resume transports, so the extra row and the extra detail dialog
 * share one playback path. Extras carry no watch state; sessions are tracked
 * for live UI only. Confirmed outcomes show through the tracked state; only
 * failures notify, and raw transport errors go to the log alone.
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
  isPaused: ComputedRef<boolean>
  isPauseActionPending: Ref<boolean>
  togglePause: () => Promise<void>
  /** In-flight transport phase, letting buttons render transitional states. */
  pendingAction: Ref<'start' | 'stop' | null>
  isActionPending: ComputedRef<boolean>
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

  const pendingAction = ref<'start' | 'stop' | null>(null)
  const isActionPending = computed(() => pendingAction.value !== null)

  async function play(fileId?: string): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'start'
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
      pendingAction.value = null
    }
  }

  async function stop(): Promise<void> {
    if (pendingAction.value) return

    pendingAction.value = 'stop'
    try {
      const result = await ipcManager.invoke('activity:stop-anime-extra', toValue(extraId))
      if (!result.success) {
        notify.error(m.value.anime.extras.stopFailed, result.error)
        return
      }
      if (result.data.status === 'failed') {
        notify.error(m.value.anime.extras.stopFailed, m.value.activity.errors[result.data.reason])
      }
    } catch (error) {
      log.error('extra stop call threw:', error)
      notify.error(m.value.anime.extras.stopFailed)
    } finally {
      pendingAction.value = null
    }
  }

  return {
    isPlaying,
    playbackStatus,
    playbackProgress,
    isPaused,
    isPauseActionPending,
    togglePause,
    pendingAction,
    isActionPending,
    play,
    stop
  }
}
