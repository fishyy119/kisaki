/**
 * Library Explorer Store
 *
 * Manages explorer panel state: the browse query (one EntityListQuery, like
 * every other browse surface), row selection, and UI preferences with
 * partial persistence. The explorer always shows a concrete type, so the
 * query's `entityType` is never null here.
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  createEntityListQuery,
  switchEntityListType,
  type EntityListQuery
} from '@renderer/composables/entity-list-query'

/** Rail width in rem: a content size, so it follows the interface scale. */
const DEFAULT_EXPLORER_WIDTH_REM = 16

export const useLibraryExplorerStore = defineStore(
  'libraryExplorer',
  () => {
    // ========================================================================
    // State - Browsing (only the sort inside the query is persisted)
    // ========================================================================

    const query = shallowRef<EntityListQuery>(createEntityListQuery('game'))
    const selectedKeys = ref<string[]>([])
    const selectionAnchorKey = ref<string | null>(null)

    /** Concrete by construction; the fallback only satisfies the query contract. */
    const activeEntityType = computed(() => query.value.entityType ?? 'game')

    // ========================================================================
    // State - UI Preferences (persisted)
    // ========================================================================

    const explorerWidthRem = ref(DEFAULT_EXPLORER_WIDTH_REM)
    const collapsedIds = ref<string[]>([])

    // ========================================================================
    // Actions
    // ========================================================================

    function dedupeKeys(keys: string[]) {
      return [...new Set(keys)]
    }

    function clearSelection() {
      selectedKeys.value = []
      selectionAnchorKey.value = null
    }

    /**
     * Replaces the browse query wholesale. A type switch drops the selection;
     * the type-bound query resets are the caller's, through
     * `switchEntityListType`.
     */
    function setQuery(next: EntityListQuery) {
      const typeChanged = next.entityType !== query.value.entityType
      query.value = next
      if (typeChanged) clearSelection()
    }

    function setSelection(keys: string[], anchorKey: string | null = null) {
      selectedKeys.value = dedupeKeys(keys)
      selectionAnchorKey.value = anchorKey
    }

    function toggleSelection(key: string) {
      if (selectedKeys.value.includes(key)) {
        selectedKeys.value = selectedKeys.value.filter((existing) => existing !== key)
        if (selectionAnchorKey.value === key) {
          selectionAnchorKey.value = null
        }
      } else {
        selectedKeys.value = [...selectedKeys.value, key]
        selectionAnchorKey.value = key
      }

      if (selectedKeys.value.length === 0) {
        selectionAnchorKey.value = null
      }
    }

    function addToSelection(keys: string[], anchorKey: string | null = null) {
      selectedKeys.value = dedupeKeys([...selectedKeys.value, ...keys])
      if (anchorKey !== null) {
        selectionAnchorKey.value = anchorKey
      }
    }

    function removeFromSelection(keys: string[]) {
      const removeSet = new Set(keys)
      selectedKeys.value = selectedKeys.value.filter((key) => !removeSet.has(key))

      if (selectionAnchorKey.value && removeSet.has(selectionAnchorKey.value)) {
        selectionAnchorKey.value = null
      }
      if (selectedKeys.value.length === 0) {
        selectionAnchorKey.value = null
      }
    }

    function selectRange(targetKey: string, orderedVisibleKeys: string[], additive: boolean) {
      const ordered = dedupeKeys(orderedVisibleKeys)
      const anchorKey = selectionAnchorKey.value

      if (!anchorKey) {
        setSelection([targetKey], targetKey)
        return
      }

      const anchorIndex = ordered.indexOf(anchorKey)
      const targetIndex = ordered.indexOf(targetKey)

      if (anchorIndex === -1 || targetIndex === -1) {
        setSelection([targetKey], targetKey)
        return
      }

      const start = Math.min(anchorIndex, targetIndex)
      const end = Math.max(anchorIndex, targetIndex)
      const rangeIds = ordered.slice(start, end + 1)

      if (additive) {
        addToSelection(rangeIds, targetKey)
      } else {
        setSelection(rangeIds, targetKey)
      }
    }

    function toggleGroupSelection(groupKeys: string[], anchorKey: string | null = null) {
      const group = dedupeKeys(groupKeys)
      const selected = new Set(selectedKeys.value)
      const isAllSelected = group.every((key) => selected.has(key))

      if (isAllSelected) {
        removeFromSelection(group)
        return
      }

      addToSelection(group, anchorKey)
    }

    function pruneSelection(allowedKeys: Set<string>) {
      const next = selectedKeys.value.filter((key) => allowedKeys.has(key))
      if (next.length === selectedKeys.value.length) return

      selectedKeys.value = next

      if (selectionAnchorKey.value && !allowedKeys.has(selectionAnchorKey.value)) {
        selectionAnchorKey.value = null
      }
      if (selectedKeys.value.length === 0) {
        selectionAnchorKey.value = null
      }
    }

    function toggleCollapsed(id: string) {
      if (collapsedIds.value.includes(id)) {
        collapsedIds.value = collapsedIds.value.filter((i) => i !== id)
      } else {
        collapsedIds.value = [...collapsedIds.value, id]
      }
    }

    return {
      // State - Browsing
      query,
      activeEntityType,
      selectedKeys,
      selectionAnchorKey,
      // State - UI Preferences
      explorerWidthRem,
      collapsedIds,
      // Actions
      setQuery,
      clearSelection,
      setSelection,
      toggleSelection,
      addToSelection,
      removeFromSelection,
      selectRange,
      toggleGroupSelection,
      pruneSelection,
      toggleCollapsed
    }
  },
  {
    persist: {
      pick: ['explorerWidthRem', 'collapsedIds', 'query.sort'],
      afterHydrate: ({ store }) => {
        // The persisted sort may name a field the launch type does not
        // declare; re-entering the same type runs the shared retention rule
        // (membership and declared keys survive, anything else falls back).
        // Search and filter are fresh at this point, so nothing else moves.
        store.setQuery(switchEntityListType(store.query, store.activeEntityType))
      }
    }
  }
)
