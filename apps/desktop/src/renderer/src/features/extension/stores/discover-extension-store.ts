/**
 * Discover Extension Store
 *
 * Pinia store for extension marketplace UI state.
 * Manages search, filtering, sorting, and repository selection.
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/common'

export type DiscoverExtensionSortField =
  'relevance' | 'name' | 'updatedAt' | 'publishedAt' | 'repositoryPriority'

export const useDiscoverExtensionStore = defineStore(
  'discoverExtension',
  () => {
    // Search input value (for controlled input)
    const searchInput = ref('')

    // Committed search query (triggers actual search)
    const searchQuery = ref('')

    // Search trigger counter (increments to trigger search)
    const searchTrigger = ref(0)

    // Selected repository for browsing (null = all enabled repositories)
    const selectedRepositoryId = ref<string | null>(null)

    // Category filter (null = all categories)
    const selectedCategory = ref<ExtensionCategory | null>(null)

    // Only show installable releases by default.
    const compatibleOnly = ref(true)

    // Sort options
    const sortField = ref<DiscoverExtensionSortField>('relevance')
    const sortDirection = ref<SortDirection>('desc')

    // Actions
    function setSearchInput(input: string) {
      searchInput.value = input
    }

    function triggerSearch() {
      searchQuery.value = searchInput.value
      searchTrigger.value++
    }

    function clearSearch() {
      searchInput.value = ''
      searchQuery.value = ''
      searchTrigger.value++
    }

    function setSelectedRepositoryId(repositoryId: string | null) {
      selectedRepositoryId.value = repositoryId
    }

    function setSelectedCategory(category: ExtensionCategory | null) {
      selectedCategory.value = category
    }

    function setCompatibleOnly(value: boolean) {
      compatibleOnly.value = value
    }

    function setSortField(field: DiscoverExtensionSortField) {
      sortField.value = field
    }

    function setSortDirection(direction: SortDirection) {
      sortDirection.value = direction
    }

    function setSort(field: DiscoverExtensionSortField, direction: SortDirection) {
      sortField.value = field
      sortDirection.value = direction
    }

    function resetFilters() {
      searchInput.value = ''
      searchQuery.value = ''
      searchTrigger.value++
      selectedCategory.value = null
      selectedRepositoryId.value = null
      compatibleOnly.value = true
      sortField.value = 'relevance'
      sortDirection.value = 'desc'
    }

    return {
      // State
      searchInput,
      searchQuery,
      searchTrigger,
      selectedRepositoryId,
      selectedCategory,
      compatibleOnly,
      sortField,
      sortDirection,
      // Actions
      setSearchInput,
      triggerSearch,
      clearSearch,
      setSelectedRepositoryId,
      setSelectedCategory,
      setCompatibleOnly,
      setSortField,
      setSortDirection,
      setSort,
      resetFilters
    }
  },
  {
    persist: {
      pick: ['selectedRepositoryId', 'compatibleOnly', 'sortField', 'sortDirection']
    }
  }
)
