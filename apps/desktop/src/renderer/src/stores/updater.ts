/**
 * Updater Store
 *
 * Tracks application update status pushed from the main process.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import type { AppUpdaterChangelogBundle, AppUpdaterState } from '@shared/updater'
import { createLogger } from '@renderer/core/log'
import { useTaskRunStore } from './task-run'

const log = createLogger('Updater')

const defaultState: AppUpdaterState = {
  status: 'idle',
  update: null,
  error: null,
  downloadProgress: null
}

export const useUpdaterStore = defineStore('updater', () => {
  const taskRunStore = useTaskRunStore()
  const state = ref<AppUpdaterState>(defaultState)
  const initialized = ref(false)
  const isInstalling = ref(false)
  const isManuallyChecking = ref(false)
  const isStartingDownload = ref(false)
  const changelogByVersion = ref<Record<string, AppUpdaterChangelogBundle>>({})
  const changelogLoadingByVersion = ref<Record<string, boolean>>({})
  const changelogErrorByVersion = ref<Record<string, string | null>>({})
  const changelogInFlight = new Map<string, Promise<AppUpdaterChangelogBundle>>()

  const hasDownloadedUpdate = computed(
    () => state.value.status === 'downloaded' && state.value.update !== null
  )

  const activeCheckRun = computed(
    () =>
      taskRunStore.activeRuns.find(
        (run) => run.category === 'updater' && run.operation === 'updater.check'
      ) ?? null
  )
  const activeDownloadRun = computed(
    () =>
      taskRunStore.activeRuns.find(
        (run) => run.category === 'updater' && run.operation === 'updater.download'
      ) ?? null
  )
  const isChecking = computed(
    () => activeCheckRun.value !== null || state.value.status === 'checking'
  )
  const isDownloading = computed(() => activeDownloadRun.value !== null)
  const canStartDownload = computed(
    () =>
      activeDownloadRun.value === null &&
      state.value.status === 'available' &&
      state.value.update !== null
  )
  const downloadProgress = computed(() => {
    const work = activeDownloadRun.value?.progress?.work
    if (!work) {
      return state.value.downloadProgress
    }

    const transferred = work.current ?? 0
    const total = work.total ?? 0
    return {
      bytesPerSecond: work.rate ?? 0,
      percent:
        work.percent ?? (total > 0 ? Math.max(0, Math.min(100, (transferred / total) * 100)) : 0),
      transferred,
      total
    }
  })

  const release = computed(() => state.value.update)
  const activeReleaseVersion = computed(() => {
    const version = release.value?.version?.trim()
    return version ? normalizeVersion(version) : null
  })
  const activeChangelog = computed(() => {
    const version = activeReleaseVersion.value
    if (!version) return null
    return changelogByVersion.value[version] ?? null
  })
  const isActiveChangelogLoading = computed(() => {
    const version = activeReleaseVersion.value
    if (!version) return false
    return changelogLoadingByVersion.value[version] ?? false
  })
  const activeChangelogError = computed(() => {
    const version = activeReleaseVersion.value
    if (!version) return null
    return changelogErrorByVersion.value[version] ?? null
  })

  function setState(next: AppUpdaterState) {
    state.value = next
  }

  function normalizeVersion(version: string): string {
    return version.trim().replace(/^v/i, '')
  }

  function setChangelogLoading(version: string, loading: boolean): void {
    const next = { ...changelogLoadingByVersion.value }
    if (loading) {
      next[version] = true
    } else {
      delete next[version]
    }
    changelogLoadingByVersion.value = next
  }

  function setChangelogError(version: string, error: string | null): void {
    const next = { ...changelogErrorByVersion.value }
    if (error) {
      next[version] = error
    } else {
      delete next[version]
    }
    changelogErrorByVersion.value = next
  }

  function setChangelog(bundle: AppUpdaterChangelogBundle): void {
    changelogByVersion.value = {
      ...changelogByVersion.value,
      [bundle.version]: bundle
    }
  }

  async function fetchChangelog(
    version: string,
    options: { force?: boolean } = {}
  ): Promise<AppUpdaterChangelogBundle> {
    const normalizedVersion = normalizeVersion(version)
    if (!normalizedVersion) {
      throw new Error('Invalid update version.')
    }

    const inFlight = changelogInFlight.get(normalizedVersion)
    if (inFlight) return inFlight

    if (!options.force) {
      const cached = changelogByVersion.value[normalizedVersion]
      if (cached) return cached
    }

    const request = (async () => {
      setChangelogLoading(normalizedVersion, true)
      setChangelogError(normalizedVersion, null)

      try {
        const bundle = unwrapIpcData(
          await ipcManager.invoke('updater:get-changelog', normalizedVersion)
        )

        setChangelog(bundle)
        return bundle
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setChangelogError(normalizedVersion, message)
        throw error
      } finally {
        setChangelogLoading(normalizedVersion, false)
      }
    })()

    changelogInFlight.set(normalizedVersion, request)
    return request.finally(() => {
      changelogInFlight.delete(normalizedVersion)
    })
  }

  async function ensureActiveReleaseChangelog(
    options: { force?: boolean } = {}
  ): Promise<AppUpdaterChangelogBundle | null> {
    const version = activeReleaseVersion.value
    if (!version) return null

    if (!options.force) {
      const cached = changelogByVersion.value[version]
      if (cached) return cached
    }

    return fetchChangelog(version, options)
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
      log.error('Failed to fetch initial updater state:', error)
    }

    initialized.value = true
  }

  async function quitAndInstall() {
    if (isInstalling.value) return
    isInstalling.value = true

    try {
      unwrapIpcVoid(await ipcManager.invoke('updater:quit-and-install'))
    } catch (error) {
      isInstalling.value = false
      throw error
    }
  }

  async function checkForUpdates() {
    if (isManuallyChecking.value) return
    isManuallyChecking.value = true

    try {
      unwrapIpcData(await ipcManager.invoke('updater:check-for-updates'))
    } finally {
      isManuallyChecking.value = false
    }
  }

  async function downloadUpdate() {
    if (isStartingDownload.value) return
    isStartingDownload.value = true

    try {
      unwrapIpcData(await ipcManager.invoke('updater:download-update'))
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
    activeCheckRun,
    activeDownloadRun,
    canStartDownload,
    downloadProgress,
    release,
    activeReleaseVersion,
    activeChangelog,
    isActiveChangelogLoading,
    activeChangelogError,
    changelogByVersion,
    changelogLoadingByVersion,
    changelogErrorByVersion,
    init,
    quitAndInstall,
    checkForUpdates,
    downloadUpdate,
    fetchChangelog,
    ensureActiveReleaseChangelog
  }
})
