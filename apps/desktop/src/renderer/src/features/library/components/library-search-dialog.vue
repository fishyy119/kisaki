<!--
  Library Search Dialog

  A finder: type, see hits, pick one. A `2xl` `fill` dialog whose hits are laid
  out in a fluid grid - as many 16rem cells as the width holds - grouped by
  content entity type under sticky section headers, with a scope switch that
  narrows the list to one type. Every hit keeps a readable cell at every tier;
  a narrower dialog holds fewer cells per row, never narrower ones.
  Opens with Ctrl+F or via the header trigger.
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
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Spinner } from '@renderer/components/ui/spinner'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { useLibrarySearch, type LibrarySearchHit } from '../composables'
import { cn } from '@renderer/utils/cn'
import { getEntityAttachmentUrl } from '@renderer/utils/entity-image'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { getEntityIcon } from '@renderer/utils/format'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'

// =============================================================================
// Types
// =============================================================================

type SearchScope = 'all' | ContentEntityType

interface ResultSection {
  type: ContentEntityType
  title: string
  items: LibrarySearchHit[]
  total: number
}

interface VisibleHit {
  type: ContentEntityType
  item: LibrarySearchHit
  sectionIndex: number
  itemIndex: number
}

/** Hits shown per type while every type is in view; the section header offers the rest. */
const SECTION_PREVIEW_LIMIT = 8

const SCOPES: readonly SearchScope[] = ['all', ...CONTENT_ENTITY_TYPES]

const { m } = useI18n()

// =============================================================================
// Props & Emits
// =============================================================================

const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// State
// =============================================================================

const router = useRouter()
const query = ref('')
const scope = ref<SearchScope>('all')
const { results, isLoading, hasResults, query: debouncedQuery } = useLibrarySearch(query)
const state = useRenderState(isLoading, null, results)
const focusedIndex = ref(-1)
const inputRef = ref<InstanceType<typeof Input>>()
const contentRef = ref<InstanceType<typeof ScrollRegion>>()

// =============================================================================
// Computed
// =============================================================================

const typeCounts = computed<Record<ContentEntityType, number>>(
  () =>
    Object.fromEntries(
      CONTENT_ENTITY_TYPES.map((type) => [type, results.value[type].length])
    ) as Record<ContentEntityType, number>
)

const totalResultCount = computed(() =>
  CONTENT_ENTITY_TYPES.reduce((total, type) => total + typeCounts.value[type], 0)
)

const sections = computed<ResultSection[]>(() => {
  if (scope.value === 'all') {
    return CONTENT_ENTITY_TYPES.filter((type) => typeCounts.value[type] > 0).map((type) => ({
      type,
      title: m.value.library.entities[type],
      items: results.value[type].slice(0, SECTION_PREVIEW_LIMIT),
      total: typeCounts.value[type]
    }))
  }
  const type = scope.value
  return [
    {
      type,
      title: m.value.library.entities[type],
      items: results.value[type],
      total: typeCounts.value[type]
    }
  ]
})

/** Every rendered hit in reading order; the keyboard cursor indexes into it. */
const visibleHits = computed<VisibleHit[]>(() =>
  sections.value.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({ type: section.type, item, sectionIndex, itemIndex }))
  )
)

const hitIndexById = computed(() => {
  const map = new Map<string, number>()
  visibleHits.value.forEach((hit, index) => map.set(`${hit.type}:${hit.item.id}`, index))
  return map
})

const scopeEmptyText = computed(() =>
  scope.value === 'all'
    ? m.value.library.search.noResults
    : m.value.library.search.emptyResult({ label: m.value.library.entities[scope.value] })
)

// =============================================================================
// Methods
// =============================================================================

function getThumbnailUrl(item: LibrarySearchHit, type: ContentEntityType): string | null {
  if (!item.imageFile) return null
  return getEntityAttachmentUrl(type, item.id, item.imageFile, { width: 100, height: 100 })
}

function scopeIcon(value: SearchScope): string {
  return value === 'all' ? 'icon-[mdi--view-grid-outline]' : getEntityIcon(value)
}

function scopeLabel(value: SearchScope): string {
  return value === 'all' ? m.value.library.search.allTypes : m.value.library.entities[value]
}

function scopeCount(value: SearchScope): number {
  return value === 'all' ? totalResultCount.value : typeCounts.value[value]
}

function hitIndex(type: ContentEntityType, item: LibrarySearchHit): number {
  return hitIndexById.value.get(`${type}:${item.id}`) ?? -1
}

function openHit(type: ContentEntityType, id: string) {
  closeDialog()
  router.push(getEntityDetailPath(type, id))
}

function closeDialog() {
  open.value = false
}

/** Cells per row of the hit grid, read from the layout; every section's grid has the same tracks. */
function gridColumnCount(): number {
  const grid = contentRef.value?.element?.querySelector('[data-hit-grid]')
  if (!grid) return 1
  return getComputedStyle(grid).gridTemplateColumns.split(' ').length
}

/** The index one row down or up from a hit, crossing into the neighbouring section's same column. */
function verticalNeighbour(index: number, direction: 1 | -1): number {
  const hits = visibleHits.value
  const current = hits[index]
  if (!current) return -1
  const columns = gridColumnCount()
  const section = sections.value[current.sectionIndex]!
  const column = current.itemIndex % columns

  const target = current.itemIndex + direction * columns
  if (target >= 0 && target < section.items.length) {
    return index - current.itemIndex + target
  }

  const neighbour = sections.value[current.sectionIndex + direction]
  if (!neighbour) return direction === 1 ? index : -1

  const neighbourStart = hits.findIndex(
    (hit) => hit.sectionIndex === current.sectionIndex + direction
  )
  const lastRowStart = Math.floor((neighbour.items.length - 1) / columns) * columns
  const itemIndex =
    direction === 1
      ? Math.min(column, neighbour.items.length - 1)
      : Math.min(lastRowStart + column, neighbour.items.length - 1)
  return neighbourStart + itemIndex
}

function handleKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown': {
      if (visibleHits.value.length === 0) return
      e.preventDefault()
      focusedIndex.value = focusedIndex.value === -1 ? 0 : verticalNeighbour(focusedIndex.value, 1)
      break
    }
    case 'ArrowUp': {
      if (focusedIndex.value === -1) return
      e.preventDefault()
      const next = verticalNeighbour(focusedIndex.value, -1)
      focusedIndex.value = next
      if (next === -1) inputRef.value?.focus()
      break
    }
    case 'ArrowRight':
    case 'ArrowLeft': {
      // Inside the query the arrows move the caret; among hits they move the cursor.
      if (focusedIndex.value === -1) return
      e.preventDefault()
      const next = focusedIndex.value + (e.key === 'ArrowRight' ? 1 : -1)
      if (next >= 0 && next < visibleHits.value.length) focusedIndex.value = next
      break
    }
    case 'Enter': {
      const hit = visibleHits.value[focusedIndex.value]
      if (!hit) return
      e.preventDefault()
      openHit(hit.type, hit.item.id)
      break
    }
  }
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
      scope.value = 'all'
      focusedIndex.value = -1
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
)

// A new list (new query or scope) starts without a cursor
watch([debouncedQuery, scope], () => {
  focusedIndex.value = -1
})

// Auto-scroll focused item into view
watch(focusedIndex, (index) => {
  const viewport = contentRef.value?.element
  if (index < 0 || !viewport) return

  const element = viewport.querySelector(`[data-result-index="${index}"]`)
  element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      size="2xl"
      fill
      :show-close-button="false"
      @keydown="handleKeyDown"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ m.library.search.title }}</DialogTitle>
        <DialogDescription>{{ m.library.search.description }}</DialogDescription>
      </DialogHeader>

      <!-- Query -->
      <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Icon
          icon="icon-[mdi--magnify]"
          class="size-5 shrink-0 text-muted-foreground"
        />
        <Input
          ref="inputRef"
          v-model="query"
          :placeholder="m.library.search.placeholder"
          class="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          autofocus
        />
        <Spinner
          v-if="state === 'loading'"
          class="size-4 shrink-0"
        />
        <kbd
          class="inline-flex h-5 shrink-0 cursor-pointer select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground"
          @click="closeDialog"
        >
          ESC
        </kbd>
      </div>

      <!-- Scope: eight items with counts; labels fold to icons in a narrow dialog -->
      <div class="@container flex shrink-0 items-center border-b px-3 py-2">
        <SegmentedControl
          v-model="scope"
          collapse-below="3xl"
        >
          <SegmentedControlItem
            v-for="value in SCOPES"
            :key="value"
            :value="value"
            :icon="scopeIcon(value)"
            :label="scopeLabel(value)"
          >
            <span
              v-if="scopeCount(value) > 0"
              class="tabular-nums text-muted-foreground"
            >
              {{ scopeCount(value) }}
            </span>
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <!-- Results -->
      <ScrollRegion
        ref="contentRef"
        class="min-h-0 grow"
      >
        <StateView
          v-if="!debouncedQuery"
          state="empty"
          size="sm"
          icon="icon-[mdi--magnify]"
          :description="m.library.search.typeToSearch"
          class="py-12"
        />

        <StateView
          v-else-if="visibleHits.length === 0"
          state="empty"
          size="sm"
          icon="icon-[mdi--magnify-close]"
          :description="scopeEmptyText"
          class="py-12"
        />

        <template v-else>
          <section
            v-for="section in sections"
            :key="section.type"
            class="pb-1"
          >
            <!-- One fixed height for every header, so the sticky handover
                 between sections never shifts the content beneath -->
            <header
              class="sticky top-0 z-10 flex h-7 items-center gap-1.5 bg-dialog px-3 text-xs font-medium text-muted-foreground"
            >
              <Icon
                :icon="getEntityIcon(section.type)"
                class="size-3.5"
              />
              <span>{{ section.title }}</span>
              <span class="tabular-nums">{{ section.total }}</span>
              <Button
                v-if="section.total > section.items.length"
                variant="ghost"
                size="xs"
                class="ml-auto"
                @click="scope = section.type"
              >
                {{ m.library.search.showAll({ count: section.total }) }}
              </Button>
            </header>

            <!-- As many 16rem cells as the width holds: thumbnail 2 + gap + a
                 readable name; a narrower dialog holds fewer per row -->
            <div
              data-hit-grid
              class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] px-1"
            >
              <Button
                v-for="item in section.items"
                :key="item.id"
                variant="ghost"
                :data-result-index="hitIndex(section.type, item)"
                :class="
                  cn(
                    'flex h-auto min-w-0 items-center justify-start gap-3 px-2 py-1.5 text-left',
                    visibleHits[focusedIndex]?.item === item && 'bg-accent'
                  )
                "
                @click="openHit(section.type, item.id)"
              >
                <div
                  class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted"
                >
                  <img
                    v-if="getThumbnailUrl(item, section.type)"
                    :src="getThumbnailUrl(item, section.type) ?? undefined"
                    :alt="item.name"
                    loading="lazy"
                    decoding="async"
                    class="size-full object-cover"
                  />
                  <Icon
                    v-else
                    :icon="getEntityIcon(section.type)"
                    class="size-4 text-muted-foreground"
                  />
                </div>
                <span class="min-w-0 truncate text-sm">{{ item.name }}</span>
              </Button>
            </div>
          </section>
        </template>
      </ScrollRegion>

      <!-- Footer -->
      <div
        class="flex shrink-0 items-center justify-between gap-4 border-t px-3 py-2 text-xs text-muted-foreground"
      >
        <div class="flex min-w-0 items-center gap-4">
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-muted px-1 py-0.5">↑↓←→</kbd>
            {{ m.library.search.navigate }}
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-muted px-1 py-0.5">Tab</kbd>
            {{ m.library.search.switchScope }}
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-muted px-1 py-0.5">Enter</kbd>
            {{ m.library.search.select }}
          </span>
        </div>
        <span
          v-if="hasResults"
          class="shrink-0"
        >
          {{ m.library.search.totalResults({ count: totalResultCount }) }}
        </span>
      </div>
    </DialogContent>
  </Dialog>
</template>
