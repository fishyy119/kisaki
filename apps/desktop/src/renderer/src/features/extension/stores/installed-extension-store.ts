/**
 * Installed Extension Store
 *
 * Pinia store for installed extensions panel UI state.
 * Manages search, filtering, and sorting for installed extensions.
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/common'

export type InstalledExtensionSortField = 'name' | 'status' | 'hasUpdate'
export type InstalledExtensionStatusFilter = 'all' | 'enabled' | 'disabled'

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

    function resetFilters() {
      searchQuery.value = ''
      statusFilter.value = 'all'
      selectedCategory.value = null
      showUpdatesOnly.value = false
    }

    return {
      // State
      searchQuery,
      statusFilter,
      selectedCategory,
      showUpdatesOnly,
      sortField,
      sortDirection,
      // Actions
      setSearchQuery,
      setStatusFilter,
      setSelectedCategory,
      setShowUpdatesOnly,
      setSortField,
      setSortDirection,
      resetFilters
    }
  },
  {
    persist: {
      pick: ['statusFilter', 'sortField', 'sortDirection']
    }
  }
)
