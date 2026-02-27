/**
 * Updater Store
 *
 * Tracks application update status pushed from the main process.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ipcManager } from '@renderer/core/ipc'
import type { AppUpdaterState } from '@shared/updater'

const defaultState: AppUpdaterState = {
  status: 'idle',
  update: null,
  error: null,
  downloadProgress: null
}

export const useUpdaterStore = defineStore('updater', () => {
  const state = ref<AppUpdaterState>(defaultState)
  const initialized = ref(false)
  const isInstalling = ref(false)
  const isManuallyChecking = ref(false)
  const isStartingDownload = ref(false)

  const hasDownloadedUpdate = computed(
    () => state.value.status === 'downloaded' && state.value.update !== null
  )

  const isChecking = computed(() => state.value.status === 'checking')
  const isDownloading = computed(() => state.value.status === 'downloading')
  const canStartDownload = computed(
    () => state.value.status === 'available' && state.value.update !== null
  )
  const downloadProgress = computed(() => state.value.downloadProgress)

  const release = computed(() => state.value.update)

  function setState(next: AppUpdaterState) {
    state.value = next
  }

  async function init() {
    if (initialized.value) return

    ipcManager.on('updater:state-changed', (_, nextState) => {
      setState(nextState)
    })

    try {
      const result = await ipcManager.invoke('updater:get-state')
      if (result.success) {
        setState(result.data)
      }
    } catch (error) {
      console.error('[UpdaterStore] Failed to fetch initial updater state:', error)
    }

    initialized.value = true
  }

  async function quitAndInstall() {
    if (isInstalling.value) return
    isInstalling.value = true

    try {
      const result = await ipcManager.invoke('updater:quit-and-install')
      if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error) {
      isInstalling.value = false
      throw error
    }
  }

  async function checkForUpdates() {
    if (isManuallyChecking.value) return
    isManuallyChecking.value = true

    try {
      const result = await ipcManager.invoke('updater:check-for-updates')
      if (!result.success) {
        throw new Error(result.error)
      }
    } finally {
      isManuallyChecking.value = false
    }
  }

  async function downloadUpdate() {
    if (isStartingDownload.value) return
    isStartingDownload.value = true

    try {
      const result = await ipcManager.invoke('updater:download-update')
      if (!result.success) {
        throw new Error(result.error)
      }
    } finally {
      isStartingDownload.value = false
    }
  }

  return {
    state,
    initialized,
    isInstalling,
    isManuallyChecking,
    isStartingDownload,
    hasDownloadedUpdate,
    isChecking,
    isDownloading,
    canStartDownload,
    downloadProgress,
    release,
    init,
    quitAndInstall,
    checkForUpdates,
    downloadUpdate
  }
})
