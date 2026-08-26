<!--
PageEngine lays out one unit's pages: paged left-to-right or right-to-left with
optional spreads, or a continuous vertical scroll for webtoons.
Boundary: it owns layout, zoom, and which pages are resident; the page bytes
come from the injected source and read state belongs to the main process.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { detectCropInsets, formatViewBox } from '@renderer/core/reader/crop'
import { buildPageSlots, findSlotIndex } from '@renderer/core/reader/spreads'
import type { PageSource } from '@renderer/core/reader/page-source'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  source: PageSource | null
  flow: ComicReadingDirection
  /** Pair facing pages; ignored in vertical flow. */
  spread: boolean
  /** Show page one alone so later spreads pair correctly. */
  coverAlone: boolean
  fitWidth: boolean
  zoom: number
  startPage: number
  /** CSS filter correcting the scan; `none` leaves pages untouched. */
  filter: string
  /** Trim uniform scanner margins off each page. */
  autoCrop: boolean
}>()

const emit = defineEmits<{
  pageChange: [pageIndex: number, pageCount: number]
  endReached: []
}>()

const log = createLogger('Reader')
const { m } = useI18n()

/** Slots kept ready ahead of the reader, and pages kept resident around them. */
const PAGED_PRELOAD_SLOTS = 2
const VERTICAL_LOAD_MARGIN = '150% 0px'
/** A page crossing the middle band of the viewport is the one being read. */
const VERTICAL_CURRENT_MARGIN = '-45% 0px -45% 0px'

const viewport = ref<HTMLElement | null>(null)
const pageIndex = ref(0)
const pageUrls = ref(new Map<number, string>())
const failedPages = ref(new Set<number>())
const residentPages = ref(new Set<number>())
const loading = ref(false)
/** Measured trim boxes, keyed by page URL; a null entry needs no trimming. */
const cropInsets = ref(new Map<string, string | null>())

const isVertical = computed(() => props.flow === 'vertical')
const isRtl = computed(() => props.flow === 'rtl')
const pageCount = computed(() => props.source?.pageCount ?? null)

/** Spreads need a known total; an unprobed container pages one at a time. */
const slots = computed(() =>
  buildPageSlots(pageCount.value ?? 0, props.spread && !isVertical.value, props.coverAlone)
)

const slotIndex = computed(() => findSlotIndex(slots.value, pageIndex.value))

const currentPages = computed<number[]>(() => {
  if (pageCount.value === null) return [pageIndex.value]
  const slot = slots.value[slotIndex.value]
  return slot ? [...slot] : []
})

/** Vertical flow enumerates every page; only resident ones carry an image. */
const verticalPages = computed(() => {
  const total = pageCount.value
  if (!isVertical.value || total === null) return []
  return Array.from({ length: total }, (_, index) => index)
})

/** Vertical flow cannot enumerate an unprobed container, so it pages instead. */
const verticalUnavailable = computed(() => isVertical.value && pageCount.value === null)
const usePagedLayout = computed(() => !isVertical.value || verticalUnavailable.value)

const isEmpty = computed(() => props.source !== null && pageCount.value === 0)

let loadObserver: IntersectionObserver | null = null
let currentObserver: IntersectionObserver | null = null
const visiblePages = new Set<number>()

watch(
  () => props.source,
  (source) => {
    resetForSource()
    if (!source) return
    setPage(props.startPage, { report: false })
  },
  { immediate: true }
)

watch(
  () => [props.spread, props.coverAlone, props.flow] as const,
  () => {
    if (!props.source) return
    void ensureVisiblePages()
    if (isVertical.value) void nextTick(() => scrollToPage(pageIndex.value))
  }
)

// Trimming is measured lazily, so turning it on has to catch up the pages that
// are already on screen.
watch(
  () => props.autoCrop,
  (enabled) => {
    if (enabled) void ensureCropInsets([...pageUrls.value.values()])
  }
)

onBeforeUnmount(() => {
  disconnectObservers()
  pageUrls.value.clear()
})

function resetForSource(): void {
  disconnectObservers()
  pageIndex.value = 0
  pageUrls.value = new Map()
  failedPages.value = new Set()
  residentPages.value = new Set()
  resetCropInsets()
  visiblePages.clear()
}

/** Moves to a page and reports it; out-of-range requests clamp to the file. */
function setPage(index: number, options: { report: boolean } = { report: true }): void {
  const total = pageCount.value
  const clamped = Math.max(0, total === null ? index : Math.min(index, Math.max(0, total - 1)))
  pageIndex.value = clamped

  void ensureVisiblePages()
  if (options.report) emit('pageChange', clamped, total ?? 0)
  if (isVertical.value) scrollToPage(clamped)
}

function next(): void {
  const total = pageCount.value
  if (isVertical.value && !verticalUnavailable.value) {
    if (total !== null && pageIndex.value >= total - 1) emit('endReached')
    else setPage(pageIndex.value + 1)
    return
  }

  const nextSlot = slots.value[slotIndex.value + 1]
  if (total !== null && !nextSlot) {
    emit('endReached')
    return
  }
  setPage(nextSlot ? nextSlot[0] : pageIndex.value + 1)
}

function previous(): void {
  if (pageIndex.value <= 0) return
  const previousSlot = slots.value[slotIndex.value - 1]
  setPage(previousSlot ? previousSlot[0] : pageIndex.value - 1)
}

/** Screen-side navigation: which side means forward depends on the flow. */
function turnLeft(): void {
  if (isRtl.value) next()
  else previous()
}

function turnRight(): void {
  if (isRtl.value) previous()
  else next()
}

defineExpose({ setPage, next, previous, turnLeft, turnRight })

async function ensureVisiblePages(): Promise<void> {
  const source = props.source
  if (!source) return

  const wanted = usePagedLayout.value ? collectPagedWindow() : [...visiblePages]
  const missing = wanted.filter(
    (index) => !pageUrls.value.has(index) && !failedPages.value.has(index)
  )
  if (missing.length === 0) return

  loading.value = currentPages.value.some((index) => !pageUrls.value.has(index))

  const resolved: string[] = []
  await Promise.all(
    missing.map(async (index) => {
      try {
        const url = await source.getPageUrl(index)
        if (props.source !== source) return
        pageUrls.value = new Map(pageUrls.value).set(index, url)
        resolved.push(url)
      } catch (error) {
        if (props.source !== source) return
        failedPages.value = new Set(failedPages.value).add(index)
        log.warn('Failed to resolve a book page.', error, { index })
      }
    })
  )

  if (props.source !== source) return
  loading.value = false
  if (props.autoCrop) void ensureCropInsets(resolved)
}

async function ensureCropInsets(urls: string[]): Promise<void> {
  const wanted = urls.filter((url) => !cropInsets.value.has(url))
  if (wanted.length === 0) return

  const measured = await Promise.all(
    wanted.map(async (url) => [url, await detectCropInsets(url)] as const)
  )

  const next = new Map(cropInsets.value)
  for (const [url, insets] of measured) {
    next.set(url, insets === null ? null : formatViewBox(insets))
  }
  cropInsets.value = next
}

/** Current slot plus the slots the reader is about to turn into. */
function collectPagedWindow(): number[] {
  const total = pageCount.value
  if (total === null) {
    return [pageIndex.value, pageIndex.value + 1].filter((index) => index >= 0)
  }

  const window: number[] = []
  for (let offset = 0; offset <= PAGED_PRELOAD_SLOTS; offset += 1) {
    const slot = slots.value[slotIndex.value + offset]
    if (slot) window.push(...slot)
  }
  const behind = slots.value[slotIndex.value - 1]
  if (behind) window.push(...behind)
  return window
}

function scrollToPage(index: number): void {
  void nextTick(() => {
    const target = viewport.value?.querySelector<HTMLElement>(`[data-page="${index}"]`)
    target?.scrollIntoView({ block: 'start' })
  })
}

/**
 * Registers a vertical page container with both observers: one decides when
 * the page is worth loading, the other which page is being read. Reading
 * position never costs a layout measurement per scroll event.
 */
function observePage(element: Element | null, index: number): void {
  if (!(element instanceof HTMLElement)) return
  element.dataset.page = String(index)

  // Child refs resolve before the scroll container's own ref, so the first
  // pages of a render wait until the observers have a root to measure against.
  if (!viewport.value) {
    pendingPages.add(element)
    void nextTick(attachPendingPages)
    return
  }
  attachPage(element)
}

const pendingPages = new Set<HTMLElement>()

function attachPendingPages(): void {
  if (!viewport.value) return
  for (const element of pendingPages) attachPage(element)
  pendingPages.clear()
}

function attachPage(element: HTMLElement): void {
  ensureObservers()
  loadObserver?.observe(element)
  currentObserver?.observe(element)
}

function ensureObservers(): void {
  loadObserver ??= new IntersectionObserver(
    (entries) => {
      let changed = false
      const resident = new Set(residentPages.value)
      for (const entry of entries) {
        const index = readPageIndex(entry.target)
        if (index === null) continue
        if (entry.isIntersecting) {
          if (!resident.has(index)) {
            resident.add(index)
            changed = true
          }
        } else if (resident.delete(index)) {
          changed = true
        }
      }
      if (!changed) return
      residentPages.value = resident
      visiblePages.clear()
      for (const index of resident) visiblePages.add(index)
      void ensureVisiblePages()
    },
    { root: viewport.value, rootMargin: VERTICAL_LOAD_MARGIN }
  )

  currentObserver ??= new IntersectionObserver(
    (entries) => {
      let topmost: number | null = null
      for (const entry of entries) {
        const index = readPageIndex(entry.target)
        if (index === null || !entry.isIntersecting) continue
        if (topmost === null || index < topmost) topmost = index
      }
      if (topmost === null || topmost === pageIndex.value) return
      pageIndex.value = topmost
      emit('pageChange', topmost, pageCount.value ?? 0)
    },
    { root: viewport.value, rootMargin: VERTICAL_CURRENT_MARGIN }
  )
}

function readPageIndex(element: Element): number | null {
  const raw = (element as HTMLElement).dataset.page
  if (raw === undefined) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) ? parsed : null
}

function disconnectObservers(): void {
  loadObserver?.disconnect()
  currentObserver?.disconnect()
  loadObserver = null
  currentObserver = null
  pendingPages.clear()
}

function handleWheel(event: WheelEvent): void {
  if (isVertical.value && !verticalUnavailable.value) return

  const host = viewport.value
  // A zoomed or fit-width page scrolls before it turns.
  const canScroll = host !== null && host.scrollHeight - host.clientHeight > 1
  if (canScroll) return

  event.preventDefault()
  if (event.deltaY > 0) next()
  else if (event.deltaY < 0) previous()
}

let panPointerId: number | null = null
let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }

function startPan(event: PointerEvent): void {
  const host = viewport.value
  if (!host || event.button !== 0) return
  const overflows = host.scrollWidth > host.clientWidth || host.scrollHeight > host.clientHeight
  if (!overflows) return

  panPointerId = event.pointerId
  panOrigin = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: host.scrollLeft,
    scrollTop: host.scrollTop
  }
  host.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent): void {
  const host = viewport.value
  if (!host || panPointerId !== event.pointerId) return
  host.scrollLeft = panOrigin.scrollLeft - (event.clientX - panOrigin.x)
  host.scrollTop = panOrigin.scrollTop - (event.clientY - panOrigin.y)
}

function endPan(event: PointerEvent): void {
  const host = viewport.value
  if (!host || panPointerId !== event.pointerId) return
  host.releasePointerCapture(event.pointerId)
  panPointerId = null
}

const isPanning = computed(() => panPointerId !== null)

/** Zoom drives real layout size, so the viewport scrolls instead of clipping. */
const pageSizeStyle = computed<Record<string, string>>(() => {
  const scale = `${Math.round(props.zoom * 100)}%`
  return props.fitWidth ? { width: scale, height: 'auto' } : { height: scale, width: 'auto' }
})

function urlOf(index: number): string | undefined {
  return pageUrls.value.get(index)
}

/** Display corrections ride on the image itself, never on the file. */
function pageStyle(index: number, size: Record<string, string>): Record<string, string> {
  const style: Record<string, string> = { ...size, filter: props.filter }
  const url = urlOf(index)
  const viewBox = props.autoCrop && url ? cropInsets.value.get(url) : null
  if (viewBox) style['object-view-box'] = viewBox
  return style
}

function resetCropInsets(): void {
  cropInsets.value = new Map()
}
</script>

<template>
  <div
    v-if="isEmpty"
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    {{ m.reader.comic.emptyPages }}
  </div>

  <!-- Continuous vertical scroll -->
  <div
    v-else-if="!usePagedLayout"
    ref="viewport"
    class="h-full overflow-y-auto"
  >
    <div class="mx-auto flex max-w-4xl flex-col">
      <div
        v-for="index in verticalPages"
        :key="index"
        :ref="(element) => observePage(element as Element | null, index)"
        class="flex min-h-64 w-full items-center justify-center"
      >
        <img
          v-if="urlOf(index)"
          :src="urlOf(index)"
          :style="pageStyle(index, { width: '100%', height: 'auto' })"
          class="select-none"
          decoding="async"
          draggable="false"
          :alt="String(index + 1)"
        />
        <Spinner
          v-else-if="!failedPages.has(index)"
          class="size-4 text-muted-foreground"
        />
        <span
          v-else
          class="text-sm text-muted-foreground"
        >
          {{ m.reader.comic.pageLoadFailed }}
        </span>
      </div>

      <slot name="vertical-footer" />
    </div>
  </div>

  <!-- Paged layout -->
  <div
    v-else
    ref="viewport"
    :class="cn('relative h-full overflow-auto', isPanning ? 'cursor-grabbing' : 'cursor-default')"
    @wheel="handleWheel"
    @pointerdown="startPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
  >
    <div
      :class="
        cn(
          'flex min-h-full w-full items-center justify-center',
          isRtl ? 'flex-row-reverse' : 'flex-row'
        )
      "
    >
      <template
        v-for="index in currentPages"
        :key="index"
      >
        <img
          v-if="urlOf(index)"
          :src="urlOf(index)"
          :style="pageStyle(index, pageSizeStyle)"
          class="max-w-full select-none object-contain"
          decoding="async"
          draggable="false"
          :alt="String(index + 1)"
        />
        <div
          v-else-if="failedPages.has(index)"
          class="flex h-full items-center justify-center px-8 text-sm text-muted-foreground"
        >
          {{ m.reader.comic.pageLoadFailed }}
        </div>
      </template>
    </div>

    <div
      v-if="loading"
      class="pointer-events-none absolute bottom-4 right-4"
    >
      <Spinner class="size-4 text-muted-foreground" />
    </div>

    <!-- Click zones -->
    <button
      type="button"
      class="absolute inset-y-0 left-0 z-10 w-1/4 cursor-w-resize opacity-0"
      :aria-label="m.reader.shortcuts.turnPage"
      @click="turnLeft"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 z-10 w-1/4 cursor-e-resize opacity-0"
      :aria-label="m.reader.shortcuts.turnPage"
      @click="turnRight"
    />
  </div>
</template>
