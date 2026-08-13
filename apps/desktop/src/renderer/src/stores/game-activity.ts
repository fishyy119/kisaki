/**
 * Game Activity Store
 *
 * Tracks game running status synced from the main process activity service.
 * Used for showing running indicators on game cards and play buttons.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Activity')

export interface GameActivityStatus {
  isRunning: boolean
  isForeground: boolean
  pid?: number
  startTime?: number
}

export const useGameActivityStore = defineStore('gameActivity', () => {
  // ==========================================================================
  // State
  // ==========================================================================

  const statuses = ref(new Map<string, GameActivityStatus>())
  const initialized = ref(false)

  // ==========================================================================
  // Getters
  // ==========================================================================

  const runningGameIds = computed(() => {
    const ids: string[] = []
    for (const [gameId, status] of statuses.value) {
      if (status.isRunning) ids.push(gameId)
    }
    return ids
  })

  const runningCount = computed(() => runningGameIds.value.length)

  // ==========================================================================
  // Actions
  // ==========================================================================

  function setGameStatus(gameId: string, status: Partial<GameActivityStatus>) {
    const existing = statuses.value.get(gameId) ?? {
      isRunning: false,
      isForeground: false
    }
    // Create new Map to trigger reactivity
    const newStatuses = new Map(statuses.value)
    newStatuses.set(gameId, { ...existing, ...status })
    statuses.value = newStatuses
  }

  function removeGameStatus(gameId: string) {
    const newStatuses = new Map(statuses.value)
    newStatuses.delete(gameId)
    statuses.value = newStatuses
  }

  function clearAllStatuses() {
    statuses.value = new Map()
  }

  function isGameRunning(gameId: string): boolean {
    return statuses.value.get(gameId)?.isRunning ?? false
  }

  function isGameForeground(gameId: string): boolean {
    return statuses.value.get(gameId)?.isForeground ?? false
  }

  function getGameStatus(gameId: string): GameActivityStatus | undefined {
    return statuses.value.get(gameId)
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function init() {
    if (initialized.value) return

    ipcManager.on('activity:game-started', (_, event) => {
      setGameStatus(event.gameId, {
        isRunning: true,
        isForeground: true,
        pid: event.pid,
        startTime: Date.now()
      })
    })

    ipcManager.on('activity:game-stopped', (_, event) => {
      setGameStatus(event.gameId, {
        isRunning: false,
        isForeground: false,
        pid: undefined,
        startTime: undefined
      })
    })

    ipcManager.on('activity:game-foreground', (_, event) => {
      setGameStatus(event.gameId, { isForeground: true })
    })

    ipcManager.on('activity:game-background', (_, event) => {
      setGameStatus(event.gameId, { isForeground: false })
    })

    try {
      const result = await ipcManager.invoke('activity:list-game-statuses')
      if (result.success && result.data) {
        for (const status of result.data) {
          setGameStatus(status.gameId, {
            isRunning: status.isRunning,
            isForeground: status.isForeground,
            pid: status.pid,
            startTime: status.startTime
          })
        }
      }
    } catch (error) {
      log.error('Failed to fetch initial status:', error)
    }

    initialized.value = true
  }

  return {
    // State
    statuses,
    initialized,
    // Getters
    runningGameIds,
    runningCount,
    // Actions
    setGameStatus,
    removeGameStatus,
    clearAllStatuses,
    isGameRunning,
    isGameForeground,
    getGameStatus,
    init
  }
})
