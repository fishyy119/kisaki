/**
 * Installed Extension Store
 *
 * Pinia store for installed extensions panel UI state: search, filtering,
 * and sorting, plus the update facts (manual check results and the
 * automatic update run) that the header actions and the panel share.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/filter'
import type {
  ExtensionAutomaticUpdateRunState,
  ExtensionUpdateCheckResult
} from '@shared/extension'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

export type InstalledExtensionSortField = 'name' | 'status' | 'hasUpdate'
export type InstalledExtensionStatusFilter = 'all' | 'enabled' | 'disabled'

function createIdleAutomaticUpdateRun(): ExtensionAutomaticUpdateRunState {
  return {
    status: 'idle',
    trigger: 'startup',
    startedAt: null,
    finishedAt: null,
    results: []
  }
}

export const useInstalledExtensionStore = defineStore(
  'installedExtension',
  () => {
    // Search query
    const searchQuery = ref('')

    // Status filter (enabled/disabled/all)
    const statusFilter = ref<InstalledExtensionStatusFilter>('all')

    // Category filter (null = all categories)
    const selectedCategory = ref<ExtensionCategory | null>(null)

    // Show only extensions with updates
    const showUpdatesOnly = ref(false)

    // Sort options
    const sortField = ref<InstalledExtensionSortField>('name')
    const sortDirection = ref<SortDirection>('asc')

    // Update facts: the latest manual check and the automatic update run
    const updateCheck = ref<ExtensionUpdateCheckResult>({ updates: [], unavailable: [] })
    const checkingUpdates = ref(false)
    const automaticUpdateRun = ref<ExtensionAutomaticUpdateRunState>(createIdleAutomaticUpdateRun())

    let listenersRegistered = false

    const updates = computed(() => updateCheck.value.updates)

    // Actions
    function setSearchQuery(query: string) {
      searchQuery.value = query
    }

    function setStatusFilter(status: InstalledExtensionStatusFilter) {
      statusFilter.value = status
    }

    function setSelectedCategory(category: ExtensionCategory | null) {
      selectedCategory.value = category
    }

    function setShowUpdatesOnly(show: boolean) {
      showUpdatesOnly.value = show
    }

    function setSortField(field: InstalledExtensionSortField) {
      sortField.value = field
    }

    function setSortDirection(direction: SortDirection) {
      sortDirection.value = direction
    }

    /** Starts tracking the automatic update run; safe to call repeatedly. */
    async function init(): Promise<void> {
      if (listenersRegistered) return
      listenersRegistered = true

      ipcManager.on('extension:automatic-update-run-changed', (_event, state) => {
        automaticUpdateRun.value = state
      })

      try {
        automaticUpdateRun.value = unwrapIpcData(
          await ipcManager.invoke('extension:get-automatic-update-run')
        )
      } catch (error) {
        log.error('Failed to load automatic update state:', error)
      }
    }

    /** Runs a manual update check and keeps the result; the caller notifies. */
    async function checkUpdates(): Promise<ExtensionUpdateCheckResult> {
      checkingUpdates.value = true
      try {
        const result = unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
        updateCheck.value = result
        return result
      } finally {
        checkingUpdates.value = false
      }
    }

    /** Drops stale check results, e.g. after installations changed. */
    function resetUpdateCheck() {
      updateCheck.value = { updates: [], unavailable: [] }
    }

    return {
      // State
      searchQuery,
      statusFilter,
      selectedCategory,
      showUpdatesOnly,
      sortField,
      sortDirection,
      updateCheck,
      checkingUpdates,
      automaticUpdateRun,
      updates,
      // Actions
      setSearchQuery,
      setStatusFilter,
      setSelectedCategory,
      setShowUpdatesOnly,
      setSortField,
      setSortDirection,
      init,
      checkUpdates,
      resetUpdateCheck
    }
  },
  {
    persist: {
      pick: ['statusFilter', 'sortField', 'sortDirection']
    }
  }
)
