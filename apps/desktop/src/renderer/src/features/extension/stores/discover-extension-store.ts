/**
 * Discover Extension Store
 *
 * Pinia store for extension marketplace UI state.
 * Manages search, filtering, sorting, and repository selection. The search
 * input owns its own debounce, so every committed value here is a query.
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { SortDirection } from '@shared/filter'

export type DiscoverExtensionSortField =
  'relevance' | 'name' | 'updatedAt' | 'publishedAt' | 'repositoryPriority'

export const useDiscoverExtensionStore = defineStore(
  'discoverExtension',
  () => {
    // Committed search query
    const searchQuery = ref('')

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
    function setSearchQuery(query: string) {
      searchQuery.value = query
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

    return {
      // State
      searchQuery,
      selectedRepositoryId,
      selectedCategory,
      compatibleOnly,
      sortField,
      sortDirection,
      // Actions
      setSearchQuery,
      setSelectedRepositoryId,
      setSelectedCategory,
      setCompatibleOnly,
      setSortField,
      setSortDirection,
      setSort
    }
  },
  {
    persist: {
      pick: ['selectedRepositoryId', 'compatibleOnly', 'sortField', 'sortDirection']
    }
  }
)
