/**
 * Tv Activity Store
 *
 * Tracks which series entries are currently being watched and which extras are
 * playing, synced from the main process activity service, plus the live
 * playback state of their player sessions. Used by watch buttons, episode
 * rows, and extra rows to show live progress without polling the database.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import type { PlaybackStatus } from '@shared/player'

const log = createLogger('Activity')

export interface TvWatchingStatus {
  episodeId: string
  /** Player session id, correlating this watch with `player:*` pushes. */
  sessionId: string
  startedAt: number
}

export interface TvExtraPlayingStatus {
  tvId: string
  /** Player session id, correlating this playback with `player:*` pushes. */
  sessionId: string
  startedAt: number
}

/** Live engine state of one tracked session; ended sessions never stay in the map. */
export interface TvPlaybackState {
  status: Exclude<PlaybackStatus, 'ended'>
  positionMs: number
  durationMs: number | null
}

export const useTvActivityStore = defineStore('tvActivity', () => {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Watching entries keyed by tvId. */
  const watching = ref(new Map<string, TvWatchingStatus>())
  /** Playing extras keyed by extraId. */
  const playingExtras = ref(new Map<string, TvExtraPlayingStatus>())
  /** Live playback state keyed by sessionId (only tracked sessions). */
  const playback = ref(new Map<string, TvPlaybackState>())
  const initialized = ref(false)

  // ==========================================================================
  // Getters
  // ==========================================================================

  const watchingTvIds = computed(() => [...watching.value.keys()])

  // ==========================================================================
  // Actions
  // ==========================================================================

  function isTvWatching(tvId: string): boolean {
    return watching.value.has(tvId)
  }

  function isEpisodeWatching(episodeId: string): boolean {
    for (const status of watching.value.values()) {
      if (status.episodeId === episodeId) return true
    }
    return false
  }

  function getWatchingStatus(tvId: string): TvWatchingStatus | undefined {
    return watching.value.get(tvId)
  }

  function getProgress(
    tvId: string
  ): { positionMs: number; durationMs: number | null } | undefined {
    return getSessionProgress(watching.value.get(tvId)?.sessionId)
  }

  function getPlaybackStatus(tvId: string): TvPlaybackState['status'] | undefined {
    const sessionId = watching.value.get(tvId)?.sessionId
    return sessionId ? playback.value.get(sessionId)?.status : undefined
  }

  function isExtraPlaying(extraId: string): boolean {
    return playingExtras.value.has(extraId)
  }

  function getExtraPlayingStatus(extraId: string): TvExtraPlayingStatus | undefined {
    return playingExtras.value.get(extraId)
  }

  function getExtraProgress(
    extraId: string
  ): { positionMs: number; durationMs: number | null } | undefined {
    return getSessionProgress(playingExtras.value.get(extraId)?.sessionId)
  }

  function getExtraPlaybackStatus(extraId: string): TvPlaybackState['status'] | undefined {
    const sessionId = playingExtras.value.get(extraId)?.sessionId
    return sessionId ? playback.value.get(sessionId)?.status : undefined
  }

  function getSessionProgress(
    sessionId: string | undefined
  ): { positionMs: number; durationMs: number | null } | undefined {
    const state = sessionId ? playback.value.get(sessionId) : undefined
    return state ? { positionMs: state.positionMs, durationMs: state.durationMs } : undefined
  }

  function startWatching(tvId: string, episodeId: string, sessionId: string): void {
    const previous = watching.value.get(tvId)
    const next = new Map(watching.value)
    next.set(tvId, { episodeId, sessionId, startedAt: Date.now() })
    watching.value = next
    // A restart hands the entry a new session; drop the superseded session state.
    if (previous && previous.sessionId !== sessionId) {
      removePlayback(previous.sessionId)
    }
  }

  function stopWatching(tvId: string): void {
    const status = watching.value.get(tvId)
    const next = new Map(watching.value)
    next.delete(tvId)
    watching.value = next
    if (status) {
      removePlayback(status.sessionId)
    }
  }

  function startPlayingExtra(extraId: string, tvId: string, sessionId: string): void {
    const previous = playingExtras.value.get(extraId)
    const next = new Map(playingExtras.value)
    next.set(extraId, { tvId, sessionId, startedAt: Date.now() })
    playingExtras.value = next
    // A restart hands the extra a new session; drop the superseded session state.
    if (previous && previous.sessionId !== sessionId) {
      removePlayback(previous.sessionId)
    }
  }

  function stopPlayingExtra(extraId: string): void {
    const status = playingExtras.value.get(extraId)
    const next = new Map(playingExtras.value)
    next.delete(extraId)
    playingExtras.value = next
    if (status) {
      removePlayback(status.sessionId)
    }
  }

  function isKnownSession(sessionId: string): boolean {
    for (const status of watching.value.values()) {
      if (status.sessionId === sessionId) return true
    }
    for (const status of playingExtras.value.values()) {
      if (status.sessionId === sessionId) return true
    }
    return false
  }

  function setPlayback(sessionId: string, state: TvPlaybackState): void {
    const next = new Map(playback.value)
    next.set(sessionId, state)
    playback.value = next
  }

  function removePlayback(sessionId: string): void {
    if (!playback.value.has(sessionId)) return
    const next = new Map(playback.value)
    next.delete(sessionId)
    playback.value = next
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function init(): Promise<void> {
    if (initialized.value) return

    ipcManager.on('activity:tv-started', (_, state) => {
      startWatching(state.tvId, state.episodeId, state.sessionId)
    })

    ipcManager.on('activity:tv-stopped', (_, state) => {
      stopWatching(state.tvId)
    })

    ipcManager.on('activity:tv-extra-started', (_, state) => {
      startPlayingExtra(state.extraId, state.tvId, state.sessionId)
    })

    ipcManager.on('activity:tv-extra-stopped', (_, state) => {
      stopPlayingExtra(state.extraId)
    })

    ipcManager.on('player:session-changed', (_, state) => {
      if (!isKnownSession(state.sessionId)) return
      if (state.status === 'ended') {
        removePlayback(state.sessionId)
        return
      }
      setPlayback(state.sessionId, {
        status: state.status,
        positionMs: state.positionMs,
        durationMs: state.durationMs
      })
    })

    ipcManager.on('player:session-progress', (_, progress) => {
      if (!isKnownSession(progress.sessionId)) return
      // Progress can land before the first status push; a moving position
      // means the engine is playing.
      const current = playback.value.get(progress.sessionId)
      setPlayback(progress.sessionId, {
        status: current?.status ?? 'playing',
        positionMs: progress.positionMs,
        durationMs: progress.durationMs
      })
    })

    try {
      const watchingResult = await ipcManager.invoke('activity:list-tv-watching')
      if (watchingResult.success && watchingResult.data) {
        for (const state of watchingResult.data) {
          startWatching(state.tvId, state.episodeId, state.sessionId)
        }
      }

      const extrasResult = await ipcManager.invoke('activity:list-tv-extras-playing')
      if (extrasResult.success && extrasResult.data) {
        for (const state of extrasResult.data) {
          startPlayingExtra(state.extraId, state.tvId, state.sessionId)
        }
      }

      // Seed live session state so status and position render right away
      // after a renderer reload, instead of waiting for the next push.
      const sessionsResult = await ipcManager.invoke('player:list-sessions')
      if (sessionsResult.success && sessionsResult.data) {
        for (const session of sessionsResult.data) {
          if (session.status === 'ended' || !isKnownSession(session.sessionId)) continue
          setPlayback(session.sessionId, {
            status: session.status,
            positionMs: session.positionMs,
            durationMs: session.durationMs
          })
        }
      }
    } catch (error) {
      log.error('Failed to fetch initial tv watching state:', error)
    }

    initialized.value = true
  }

  return {
    // State
    watching,
    playingExtras,
    playback,
    initialized,
    // Getters
    watchingTvIds,
    // Actions
    isTvWatching,
    isEpisodeWatching,
    getWatchingStatus,
    getProgress,
    getPlaybackStatus,
    isExtraPlaying,
    getExtraPlayingStatus,
    getExtraProgress,
    getExtraPlaybackStatus,
    init
  }
})
