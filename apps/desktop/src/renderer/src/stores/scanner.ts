/**
 * Scanner Store
 *
 * Owns the scanner page read model for active runs and the last run result in
 * the current app lifecycle.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  isActiveScannerRunStatus,
  type ScannerRunStartResult,
  type ScannerRunState
} from '@shared/scanner'
import type { MediaType } from '@shared/common'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Scanner')

export const useScannerStore = defineStore('scanner', () => {
  const scannerStates = ref(new Map<string, ScannerRunState>())
  const initialized = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)

  let listenersRegistered = false

  const activeScannerStates = computed(() =>
    [...scannerStates.value.values()].filter((state) => isActiveScannerRunStatus(state.status))
  )

  const hasActiveScans = computed(() => activeScannerStates.value.length > 0)

  function setScannerState(state: ScannerRunState): void {
    const next = new Map(scannerStates.value)
    next.set(state.scannerId, state)
    scannerStates.value = next
  }

  function replaceScannerStates(states: readonly ScannerRunState[]): void {
    const next = new Map<string, ScannerRunState>()
    for (const state of states) {
      next.set(state.scannerId, state)
    }
    scannerStates.value = next
  }

  function getScannerState(id: string): ScannerRunState | undefined {
    return scannerStates.value.get(id)
  }

  async function refresh(): Promise<void> {
    refreshing.value = true
    error.value = null

    try {
      replaceScannerStates(await ipcManager.invoke('scanner:list-run-states').then(unwrapIpcData))
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
      error.value = message
      log.error('Failed to refresh scanner runs:', refreshError)
      throw refreshError
    } finally {
      refreshing.value = false
    }
  }

  async function init(): Promise<void> {
    if (initialized.value) return

    setupListeners()

    try {
      await refresh()
      initialized.value = true
    } catch {
      initialized.value = false
    }
  }

  async function startScan(scannerId: string): Promise<ScannerRunStartResult> {
    return unwrapIpcData(await ipcManager.invoke('scanner:start-scan', scannerId))
  }

  async function startAllScans(mediaType?: MediaType): Promise<ScannerRunStartResult[]> {
    return unwrapIpcData(await ipcManager.invoke('scanner:start-all-scans', mediaType))
  }

  async function pauseScan(scannerId: string): Promise<boolean> {
    const state = getScannerState(scannerId)
    if (!state || !isActiveScannerRunStatus(state.status)) {
      return false
    }
    return unwrapIpcData(await ipcManager.invoke('scanner:pause-scan', scannerId))
  }

  async function resumeScan(scannerId: string): Promise<boolean> {
    const state = getScannerState(scannerId)
    if (!state || !isActiveScannerRunStatus(state.status)) {
      return false
    }
    return unwrapIpcData(await ipcManager.invoke('scanner:resume-scan', scannerId))
  }

  async function cancelScan(scannerId: string): Promise<boolean> {
    const state = getScannerState(scannerId)
    if (!state || !isActiveScannerRunStatus(state.status)) {
      return false
    }
    return unwrapIpcData(await ipcManager.invoke('scanner:cancel-scan', scannerId))
  }

  function setupListeners(): void {
    if (listenersRegistered) return
    listenersRegistered = true

    ipcManager.on('scanner:run-state-changed', (_event, state) => {
      setScannerState(state)
    })
  }

  return {
    scannerStates,
    initialized,
    refreshing,
    error,
    activeScannerStates,
    hasActiveScans,
    init,
    refresh,
    getScannerState,
    startScan,
    startAllScans,
    pauseScan,
    resumeScan,
    cancelScan
  }
})
