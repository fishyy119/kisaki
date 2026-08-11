/**
 * Anime Activity Store
 *
 * Tracks which anime entries are currently being watched, synced from the main
 * process activity service, plus the live playback state of their player
 * sessions. Used by watch buttons and episode rows to show the live episode
 * and its progress without polling the database.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import type { PlaybackStatus } from '@shared/player'

const log = createLogger('Activity')

export interface AnimeWatchingStatus {
  episodeId: string
  /** Player session id, correlating this watch with `player:*` pushes. */
  sessionId: string
  startedAt: number
}

/** Live engine state of one tracked session; ended sessions never stay in the map. */
export interface AnimePlaybackState {
  status: Exclude<PlaybackStatus, 'ended'>
  positionMs: number
  durationMs: number | null
}

export const useAnimeActivityStore = defineStore('animeActivity', () => {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Watching entries keyed by animeId. */
  const watching = ref(new Map<string, AnimeWatchingStatus>())
  /** Live playback state keyed by sessionId (only sessions tracked in `watching`). */
  const playback = ref(new Map<string, AnimePlaybackState>())
  const initialized = ref(false)

  // ==========================================================================
  // Getters
  // ==========================================================================

  const watchingAnimeIds = computed(() => [...watching.value.keys()])

  // ==========================================================================
  // Actions
  // ==========================================================================

  function isAnimeWatching(animeId: string): boolean {
    return watching.value.has(animeId)
  }

  function isEpisodeWatching(episodeId: string): boolean {
    for (const status of watching.value.values()) {
      if (status.episodeId === episodeId) return true
    }
    return false
  }

  function getWatchingStatus(animeId: string): AnimeWatchingStatus | undefined {
    return watching.value.get(animeId)
  }

  function getProgress(
    animeId: string
  ): { positionMs: number; durationMs: number | null } | undefined {
    const sessionId = watching.value.get(animeId)?.sessionId
    const state = sessionId ? playback.value.get(sessionId) : undefined
    return state ? { positionMs: state.positionMs, durationMs: state.durationMs } : undefined
  }

  function getPlaybackStatus(animeId: string): AnimePlaybackState['status'] | undefined {
    const sessionId = watching.value.get(animeId)?.sessionId
    return sessionId ? playback.value.get(sessionId)?.status : undefined
  }

  function startWatching(animeId: string, episodeId: string, sessionId: string): void {
    const previous = watching.value.get(animeId)
    const next = new Map(watching.value)
    next.set(animeId, { episodeId, sessionId, startedAt: Date.now() })
    watching.value = next
    // A restart hands the entry a new session; drop the superseded session state.
    if (previous && previous.sessionId !== sessionId) {
      removePlayback(previous.sessionId)
    }
  }

  function stopWatching(animeId: string): void {
    const status = watching.value.get(animeId)
    const next = new Map(watching.value)
    next.delete(animeId)
    watching.value = next
    if (status) {
      removePlayback(status.sessionId)
    }
  }

  function isKnownSession(sessionId: string): boolean {
    for (const status of watching.value.values()) {
      if (status.sessionId === sessionId) return true
    }
    return false
  }

  function setPlayback(sessionId: string, state: AnimePlaybackState): void {
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

    ipcManager.on('activity:anime-started', (_, state) => {
      startWatching(state.animeId, state.episodeId, state.sessionId)
    })

    ipcManager.on('activity:anime-stopped', (_, state) => {
      stopWatching(state.animeId)
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
      const watchingResult = await ipcManager.invoke('activity:list-anime-watching')
      if (watchingResult.success && watchingResult.data) {
        for (const state of watchingResult.data) {
          startWatching(state.animeId, state.episodeId, state.sessionId)
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
      log.error('Failed to fetch initial anime watching state:', error)
    }

    initialized.value = true
  }

  return {
    // State
    watching,
    playback,
    initialized,
    // Getters
    watchingAnimeIds,
    // Actions
    isAnimeWatching,
    isEpisodeWatching,
    getWatchingStatus,
    getProgress,
    getPlaybackStatus,
    startWatching,
    stopWatching,
    init
  }
})
