<!--
  Library Search Dialog

  Modal dialog for searching across all entity types within the library.
  Displays one result column per content entity type. Opens with Ctrl+K
  shortcut or via button trigger.
-->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { useLibrarySearch, type LibrarySearchResult } from '../composables'
import type { EntityRowMap } from '@renderer/core/db'
import { cn } from '@renderer/utils/cn'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { getEntityIcon } from '@renderer/utils/format'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'

// =============================================================================
// Types
// =============================================================================

type SearchResultItem = EntityRowMap[ContentEntityType]

interface ColumnConfig {
  type: ContentEntityType
  title: string
  emptyText: string
}

/** Which result list of the search response belongs to each entity type. */
const RESULT_LISTS: Record<ContentEntityType, (result: LibrarySearchResult) => SearchResultItem[]> =
  {
    game: (result) => result.games,
    anime: (result) => result.animes,
    comic: (result) => result.comics,
    novel: (result) => result.novels,
    character: (result) => result.characters,
    person: (result) => result.persons,
    company: (result) => result.companies
  }

const { m } = useI18n()

const COLUMNS = computed<ColumnConfig[]>(() =>
  CONTENT_ENTITY_TYPES.map((type) => ({
    type,
    title: m.value.library.entities[type],
    emptyText: m.value.library.search.emptyResult({ label: m.value.library.entities[type] })
  }))
)

// =============================================================================
// Props & Emits
// =============================================================================

const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// State
// =============================================================================

const router = useRouter()
const query = ref('')
const { results, isLoading, hasResults, query: debouncedQuery } = useLibrarySearch(query)
const state = useRenderState(isLoading, null, results)
const focusedIndex = ref(-1)
const inputRef = ref<HTMLInputElement>()
const contentRef = ref<HTMLDivElement>()
const prevDebouncedQuery = ref('')

// =============================================================================
// Computed
// =============================================================================

// Build flattened list of all results with column info for keyboard navigation
const flatResults = computed(() => {
  return COLUMNS.value.flatMap((config, columnIndex) => {
    const items = RESULT_LISTS[config.type](results.value)
    return items.map((item, itemIndex) => ({
      item,
      type: config.type,
      columnIndex,
      itemIndex
    }))
  })
})

// Build column-based index map for efficient navigation
const columnItems = computed(() => {
  return COLUMNS.value.map((_, colIndex) =>
    flatResults.value
      .map((r, globalIndex) => ({ ...r, globalIndex }))
      .filter((r) => r.columnIndex === colIndex)
  )
})

// Total result count
const totalResultCount = computed(() =>
  Object.values(results.value).reduce((total, entities) => total + entities.length, 0)
)

// =============================================================================
// Methods
// =============================================================================

function getThumbnailUrl(item: SearchResultItem, type: ContentEntityType): string | null {
  return getEntityImageUrl(type, item, 'cover', { width: 100, height: 100 })
}

function handleResultClick(type: ContentEntityType, id: string) {
  closeDialog()
  router.push(getEntityDetailPath(type, id))
}

function closeDialog() {
  open.value = false
}

function handleKeyDown(e: KeyboardEvent) {
  const isNavigationKey = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(
    e.key
  )
  if (!isNavigationKey) return
  if (flatResults.value.length === 0 && e.key !== 'Enter') return

  e.preventDefault()

  switch (e.key) {
    case 'ArrowDown': {
      if (focusedIndex.value === -1) {
        // Enter first result of first non-empty column
        const firstItem = flatResults.value[0]
        if (firstItem) focusedIndex.value = 0
      } else {
        const current = flatResults.value[focusedIndex.value]
        const col = columnItems.value[current.columnIndex]
        const currentIdx = col.findIndex((r) => r.globalIndex === focusedIndex.value)
        if (currentIdx < col.length - 1) {
          focusedIndex.value = col[currentIdx + 1].globalIndex
        }
      }
      break
    }
    case 'ArrowUp': {
      if (focusedIndex.value === -1) return
      const current = flatResults.value[focusedIndex.value]
      const col = columnItems.value[current.columnIndex]
      const currentIdx = col.findIndex((r) => r.globalIndex === focusedIndex.value)
      if (currentIdx > 0) {
        focusedIndex.value = col[currentIdx - 1].globalIndex
      } else {
        // At top of column, go back to input
        focusedIndex.value = -1
        inputRef.value?.focus()
      }
      break
    }
    case 'ArrowRight': {
      if (focusedIndex.value === -1) return
      const current = flatResults.value[focusedIndex.value]
      // Find next non-empty column
      for (let col = current.columnIndex + 1; col < COLUMNS.value.length; col++) {
        const targetCol = columnItems.value[col]
        if (targetCol.length > 0) {
          // Try to match row index, clamp to column length
          const targetIdx = Math.min(current.itemIndex, targetCol.length - 1)
          focusedIndex.value = targetCol[targetIdx].globalIndex
          break
        }
      }
      break
    }
    case 'ArrowLeft': {
      if (focusedIndex.value === -1) return
      const current = flatResults.value[focusedIndex.value]
      // Find previous non-empty column
      for (let col = current.columnIndex - 1; col >= 0; col--) {
        const targetCol = columnItems.value[col]
        if (targetCol.length > 0) {
          // Try to match row index, clamp to column length
          const targetIdx = Math.min(current.itemIndex, targetCol.length - 1)
          focusedIndex.value = targetCol[targetIdx].globalIndex
          break
        }
      }
      break
    }
    case 'Enter': {
      if (focusedIndex.value >= 0 && focusedIndex.value < flatResults.value.length) {
        const { type, item } = flatResults.value[focusedIndex.value]
        handleResultClick(type, item.id)
      }
      break
    }
  }
}

function getColumnItems(config: ColumnConfig) {
  return RESULT_LISTS[config.type](results.value)
}

function getGlobalIndex(columnIndex: number, itemIndex: number) {
  return flatResults.value.findIndex(
    (r) => r.columnIndex === columnIndex && r.itemIndex === itemIndex
  )
}

// =============================================================================
// Watchers
// =============================================================================

// Reset state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      query.value = ''
      focusedIndex.value = -1
      prevDebouncedQuery.value = ''
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
)

// Reset focus when results change
watch(
  () => debouncedQuery.value,
  (newQuery) => {
    if (prevDebouncedQuery.value !== newQuery) {
      prevDebouncedQuery.value = newQuery
      if (focusedIndex.value !== -1) {
        focusedIndex.value = -1
      }
    }
  }
)

// Auto-scroll focused item into view
watch(
  () => focusedIndex.value,
  (index) => {
    if (index < 0 || !contentRef.value) return

    const element = contentRef.value.querySelector(`[data-result-index="${index}"]`)
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-7xl p-0"
      :show-close-button="false"
      @keydown="handleKeyDown"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ m.library.search.title }}</DialogTitle>
        <DialogDescription>{{ m.library.search.description }}</DialogDescription>
      </DialogHeader>

      <!-- Search input -->
      <div class="flex items-center gap-2 px-3 py-2 border-b">
        <span class="icon-[mdi--magnify] size-5 text-muted-foreground shrink-0" />
        <Input
          ref="inputRef"
          v-model="query"
          :placeholder="m.library.search.placeholder"
          class="border-0 shadow-none bg-transparent focus-visible:ring-0 h-8 px-0"
          autofocus
        />
        <Spinner
          v-if="state === 'loading'"
          class="size-4 shrink-0"
        />
        <kbd
          class="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground cursor-pointer"
          @click="closeDialog"
        >
          ESC
        </kbd>
      </div>

      <!-- Results grid -->
      <div
        ref="contentRef"
        class="grid grid-cols-7 divide-x"
      >
        <div
          v-for="(config, columnIndex) in COLUMNS"
          :key="config.type"
          class="flex flex-col min-w-0"
        >
          <!-- Column header -->
          <div
            class="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b"
          >
            <span :class="`${getEntityIcon(config.type)} size-3.5`" />
            <span>{{ config.title }}</span>
            <span
              v-if="getColumnItems(config).length > 0"
              class="ml-auto text-xs"
            >
              {{ getColumnItems(config).length }}
            </span>
          </div>

          <!-- Column content -->
          <div class="overflow-auto py-1 h-[50vh]">
            <StateView
              v-if="getColumnItems(config).length === 0"
              state="empty"
              size="sm"
              :description="debouncedQuery ? config.emptyText : m.library.search.typeToSearch"
              class="px-2 py-4"
            />
            <template v-else>
              <div class="space-y-0.5">
                <Button
                  v-for="(item, itemIndex) in getColumnItems(config)"
                  :key="item.id"
                  variant="ghost"
                  :data-result-index="getGlobalIndex(columnIndex, itemIndex)"
                  :class="
                    cn(
                      'w-full flex items-center justify-start h-auto rounded-none gap-2 px-2 py-1.5 text-left hover:bg-accent transition-colors',
                      focusedIndex === getGlobalIndex(columnIndex, itemIndex) && 'bg-accent'
                    )
                  "
                  @click="() => handleResultClick(config.type, item.id)"
                >
                  <!-- Thumbnail -->
                  <div
                    class="size-8 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center"
                  >
                    <img
                      v-if="getThumbnailUrl(item, config.type)"
                      :src="getThumbnailUrl(item, config.type) ?? undefined"
                      :alt="item.name"
                      class="size-full object-cover"
                    />
                    <span
                      v-else
                      :class="`${getEntityIcon(config.type)} size-4 text-muted-foreground`"
                    />
                  </div>

                  <!-- Name -->
                  <span class="text-sm truncate">{{ item.name }}</span>
                </Button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground"
      >
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 bg-muted rounded">↑↓</kbd>
            {{ m.library.search.navigate }}
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 bg-muted rounded">Enter</kbd>
            {{ m.library.search.select }}
          </span>
        </div>
        <span v-if="hasResults">{{
          m.library.search.totalResults({ count: totalResultCount })
        }}</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
