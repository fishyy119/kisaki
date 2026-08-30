<!--
PageEngine lays out one unit's pages: paged left-to-right or right-to-left with
optional spreads, or a continuous vertical scroll for webtoons.
Boundary: it owns layout, zoom, and which pages are resident; the page bytes
come from the injected source and read state belongs to the main process.
Every page is measured before it is shown, so fit modes and zoom are computed
against real dimensions instead of guessed with CSS.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { detectCropInsets, formatViewBox, type CropInsets } from '@renderer/core/reader/image/crop'
import {
  buildPageSlots,
  clampZoom,
  computeSlotLayout,
  findSlotIndex,
  isWidePage,
  ZOOM_STEP,
  type PageDims,
  type PageFitMode,
  type PageLayoutMode
} from '@renderer/core/reader/image/layout'
import type { PageSource } from '@renderer/core/reader/image/source'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  source: PageSource | null
  pageFlow: ComicReadingDirection
  /** How pages share a screen; ignored in vertical flow. */
  pageLayout: PageLayoutMode
  fit: PageFitMode
  startPage: number
  /** CSS filter correcting the scan; `none` leaves pages untouched. */
  filter: string
  /** Trim uniform scanner margins off each page. */
  autoCrop: boolean
}>()

/** Zoom multiplies the fit base; the engine writes back for wheel and dblclick. */
const zoom = defineModel<number>('zoom', { default: 1 })

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
/** Reading column ceiling of the vertical flow at zoom 1. */
const VERTICAL_MAX_COLUMN_PX = 896
/** Pointer travel that turns a press into a pan instead of a click. */
const PAN_SLOP_PX = 4

/**
 * A page the engine has resolved far enough to lay out: its display URL, the
 * measured pixels behind it, and the trim box when one was measured. Crop
 * stays a measurement fact here; whether it applies is the prop's call.
 */
interface ResolvedPage {
  url: string
  natural: PageDims
  /** Measured trim box; null means measured and clean, undefined unmeasured. */
  crop: CropInsets | null | undefined
  /** Device-pixel width the URL was produced for; rasterizers may re-render. */
  requestedWidth: number
}

const viewport = ref<HTMLElement | null>(null)
const viewportSize = ref<PageDims>({ width: 0, height: 0 })
const pageIndex = ref(0)
const pages = ref(new Map<number, ResolvedPage>())
const failedPages = ref(new Set<number>())
const loading = ref(false)
const isPanning = ref(false)

const isVertical = computed(() => props.pageFlow === 'vertical')
const isRtl = computed(() => props.pageFlow === 'rtl')
const pageCount = computed(() => props.source?.pageCount ?? 0)
const isEmpty = computed(() => props.source !== null && pageCount.value === 0)

/** Pages measured wide stand alone; the rest pair by the chosen layout. */
const widePages = computed<ReadonlySet<number>>(() => {
  const wide = new Set<number>()
  for (const [index, record] of pages.value) {
    if (isWidePage(record.natural)) wide.add(index)
  }
  return wide
})

const slots = computed(() =>
  buildPageSlots(pageCount.value, isVertical.value ? 'single' : props.pageLayout, widePages.value)
)

const slotIndex = computed(() => findSlotIndex(slots.value, pageIndex.value))
const currentPages = computed<readonly number[]>(() => slots.value[slotIndex.value] ?? [])

/** Vertical flow enumerates every page; only resident ones carry an image. */
const verticalPages = computed(() => {
  if (!isVertical.value) return []
  return Array.from({ length: pageCount.value }, (_, index) => index)
})

let resizeObserver: ResizeObserver | null = null
let loadObserver: IntersectionObserver | null = null
let currentObserver: IntersectionObserver | null = null
const visiblePages = new Set<number>()
/** Vertical page elements mounted before the scroll container ref resolved. */
const pendingPages = new Set<HTMLElement>()

watch(viewport, (element) => {
  resizeObserver ??= new ResizeObserver((entries) => {
    const box = entries.at(-1)?.contentRect
    if (box) viewportSize.value = { width: box.width, height: box.height }
  })
  resizeObserver.disconnect()
  if (element) {
    resizeObserver.observe(element)
    viewportSize.value = { width: element.clientWidth, height: element.clientHeight }
  }
})

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
  () => [props.pageLayout, props.pageFlow] as const,
  () => {
    if (!props.source) return
    disconnectPageObservers()
    void ensureVisiblePages()
    if (isVertical.value) scrollToPage(pageIndex.value)
  }
)

// Zoom and fit change what resolution a rasterizing source should render at.
watch([zoom, () => props.fit], () => {
  void ensureVisiblePages()
})

// Trimming is measured lazily, so turning it on has to catch up the pages
// that are already resolved.
watch(
  () => props.autoCrop,
  (enabled) => {
    if (enabled) void ensureCropMeasurements()
  }
)

// A new slot starts reading at its natural edge: the top, on the side the
// flow reads from.
watch(slotIndex, () => {
  if (!isVertical.value) void nextTick(resetPagedScroll)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  disconnectPageObservers()
  pages.value.clear()
})

function resetForSource(): void {
  disconnectPageObservers()
  pageIndex.value = 0
  pages.value = new Map()
  failedPages.value = new Set()
  visiblePages.clear()
}

/** Moves to a page and reports it; out-of-range requests clamp to the file. */
function setPage(index: number, options: { report: boolean } = { report: true }): void {
  const total = pageCount.value
  const clamped = Math.max(0, Math.min(index, Math.max(0, total - 1)))
  pageIndex.value = clamped

  void ensureVisiblePages()
  if (options.report) emit('pageChange', clamped, total)
  if (isVertical.value) scrollToPage(clamped)
}

function next(): void {
  if (isVertical.value) {
    if (pageIndex.value >= pageCount.value - 1) emit('endReached')
    else setPage(pageIndex.value + 1)
    return
  }

  const nextSlot = slots.value[slotIndex.value + 1]
  if (!nextSlot) {
    emit('endReached')
    return
  }
  setPage(nextSlot[0]!)
}

function previous(): void {
  if (pageIndex.value <= 0) return
  const previousSlot = slots.value[slotIndex.value - 1]
  setPage(previousSlot ? previousSlot[0]! : pageIndex.value - 1)
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

// =============================================================================
// Page resolution
// =============================================================================

/** Device pixels the widest layout of the moment would put behind one page. */
function pageTargetWidth(): number {
  const devicePixelRatio = window.devicePixelRatio || 1
  if (isVertical.value) {
    return Math.max(1, Math.round(verticalColumnWidth.value * devicePixelRatio))
  }
  const width = viewportSize.value.width || 1200
  return Math.max(1, Math.round(width * devicePixelRatio * zoom.value))
}

async function ensureVisiblePages(): Promise<void> {
  const source = props.source
  if (!source) return

  const wanted = isVertical.value ? [...visiblePages] : collectPagedWindow()
  const targetWidth = pageTargetWidth()
  const missing = wanted.filter((index) => {
    if (failedPages.value.has(index)) return false
    const record = pages.value.get(index)
    return !record || targetWidth > record.requestedWidth
  })
  if (missing.length === 0) return

  loading.value = currentPages.value.some((index) => !pages.value.has(index))

  await Promise.all(missing.map((index) => resolvePage(source, index, targetWidth)))

  if (props.source !== source) return
  loading.value = false
}

/**
 * Resolves one page far enough to lay out: URL, measured size, and the trim
 * box when trimming is on. A rasterizing source may answer a sharper URL for
 * a larger target, in which case the page is measured again.
 */
async function resolvePage(source: PageSource, index: number, targetWidth: number): Promise<void> {
  try {
    const url = await source.getPageUrl(index, targetWidth)
    if (props.source !== source) return

    const existing = pages.value.get(index)
    if (existing && existing.url === url) {
      existing.requestedWidth = Math.max(existing.requestedWidth, targetWidth)
      return
    }

    const image = await loadPageImage(url)
    if (props.source !== source) return

    const record: ResolvedPage = {
      url,
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      crop: existing?.crop,
      requestedWidth: targetWidth
    }
    pages.value = new Map(pages.value).set(index, record)

    if (props.autoCrop && record.crop === undefined) {
      const crop = await detectCropInsets(url)
      if (props.source !== source) return
      updatePage(index, { crop })
    }
  } catch (error) {
    if (props.source !== source) return
    failedPages.value = new Set(failedPages.value).add(index)
    log.warn('Failed to resolve a book page.', error, { index })
  }
}

function updatePage(index: number, patch: Partial<ResolvedPage>): void {
  const record = pages.value.get(index)
  if (!record) return
  pages.value = new Map(pages.value).set(index, { ...record, ...patch })
}

/** Measures crop for pages resolved before trimming was switched on. */
async function ensureCropMeasurements(): Promise<void> {
  const source = props.source
  for (const [index, record] of pages.value) {
    if (record.crop !== undefined) continue
    const crop = await detectCropInsets(record.url)
    if (props.source !== source) return
    updatePage(index, { crop })
  }
}

function loadPageImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Matches the crop measurement's request mode, so both share one fetch.
    image.crossOrigin = 'anonymous'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Page image failed to load')))
    image.src = url
  })
}

/** Current slot plus the slots the reader is about to turn into. */
function collectPagedWindow(): number[] {
  const window: number[] = []
  for (let offset = 0; offset <= PAGED_PRELOAD_SLOTS; offset += 1) {
    const slot = slots.value[slotIndex.value + offset]
    if (slot) window.push(...slot)
  }
  const behind = slots.value[slotIndex.value - 1]
  if (behind) window.push(...behind)
  return window
}

// =============================================================================
// Geometry
// =============================================================================

/** Displayed size of one page: its pixels, minus any trimmed margins. */
function effectiveDims(record: ResolvedPage): PageDims {
  const crop = props.autoCrop ? record.crop : null
  if (!crop) return record.natural
  return {
    width: record.natural.width * Math.max(0, 1 - crop.left - crop.right),
    height: record.natural.height * Math.max(0, 1 - crop.top - crop.bottom)
  }
}

function viewBoxOf(record: ResolvedPage): string | null {
  const crop = props.autoCrop ? record.crop : null
  return crop ? formatViewBox(crop) : null
}

/** Pixel sizes of the current slot; empty until every page is measured. */
const slotSizes = computed<Map<number, PageDims>>(() => {
  const sizes = new Map<number, PageDims>()
  if (viewportSize.value.width <= 0 || viewportSize.value.height <= 0) return sizes

  const records = currentPages.value.map((index) => pages.value.get(index))
  if (records.some((record) => record === undefined)) return sizes

  const dims = (records as ResolvedPage[]).map((record) => effectiveDims(record))
  const layout = computeSlotLayout(viewportSize.value, dims, props.fit, zoom.value)
  currentPages.value.forEach((index, position) => {
    sizes.set(index, layout[position]!)
  })
  return sizes
})

function pagedStyle(index: number): Record<string, string> {
  const record = pages.value.get(index)
  const size = slotSizes.value.get(index)
  if (!record || !size) return {}

  const style: Record<string, string> = {
    width: `${size.width}px`,
    height: `${size.height}px`,
    filter: props.filter
  }
  const viewBox = viewBoxOf(record)
  if (viewBox) style['object-view-box'] = viewBox
  return style
}

/** Reading column of the vertical flow; zoom scales it against the viewport. */
const verticalColumnWidth = computed(() => {
  const width = viewportSize.value.width
  if (width <= 0) return 0
  return Math.round(Math.min(width, VERTICAL_MAX_COLUMN_PX) * zoom.value)
})

/** Container style of one vertical page; measured pages reserve their height. */
function verticalPageStyle(index: number): Record<string, string> {
  const record = pages.value.get(index)
  const style: Record<string, string> = { width: `${verticalColumnWidth.value}px` }
  if (record) {
    const dims = effectiveDims(record)
    if (dims.width > 0) style['aspect-ratio'] = `${dims.width} / ${dims.height}`
  }
  return style
}

function verticalImageStyle(index: number): Record<string, string> {
  const record = pages.value.get(index)
  if (!record) return {}
  const style: Record<string, string> = { filter: props.filter }
  const viewBox = viewBoxOf(record)
  if (viewBox) style['object-view-box'] = viewBox
  return style
}

// =============================================================================
// Interaction
// =============================================================================

function stepZoom(delta: number): void {
  const next = clampZoom(zoom.value + delta)
  if (next === zoom.value) return

  // Keep the point at the middle of the viewport where it was.
  const host = viewport.value
  const anchor =
    host === null
      ? null
      : {
          x: (host.scrollLeft + host.clientWidth / 2) / Math.max(1, host.scrollWidth),
          y: (host.scrollTop + host.clientHeight / 2) / Math.max(1, host.scrollHeight)
        }
  zoom.value = next

  if (!host || !anchor) return
  void nextTick(() => {
    host.scrollLeft = anchor.x * host.scrollWidth - host.clientWidth / 2
    host.scrollTop = anchor.y * host.scrollHeight - host.clientHeight / 2
  })
}

function handleWheel(event: WheelEvent): void {
  if (event.ctrlKey) {
    event.preventDefault()
    stepZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    return
  }
  if (isVertical.value) return

  // An overflowing page scrolls first; the turn waits at the edge.
  const host = viewport.value
  const down = event.deltaY > 0
  if (host && canScrollVertically(host, down)) return

  event.preventDefault()
  if (down) next()
  else previous()
}

function canScrollVertically(host: HTMLElement, down: boolean): boolean {
  const maxScroll = host.scrollHeight - host.clientHeight
  if (maxScroll <= 1) return false
  return down ? host.scrollTop < maxScroll - 1 : host.scrollTop > 1
}

/** Fresh slots read from the top, starting at the edge the flow reads from. */
function resetPagedScroll(): void {
  const host = viewport.value
  if (!host) return
  host.scrollTop = 0
  host.scrollLeft = isRtl.value ? host.scrollWidth : 0
}

let panPointerId: number | null = null
let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }

function startPan(event: PointerEvent): void {
  const host = viewport.value
  if (!host || event.button !== 0) return

  panPointerId = event.pointerId
  panOrigin = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: host.scrollLeft,
    scrollTop: host.scrollTop
  }
}

function movePan(event: PointerEvent): void {
  const host = viewport.value
  if (!host || panPointerId !== event.pointerId) return

  const deltaX = event.clientX - panOrigin.x
  const deltaY = event.clientY - panOrigin.y

  // Capture only once real travel proves this is a pan, so plain clicks still
  // reach the page-turn zones underneath.
  if (!isPanning.value) {
    if (Math.hypot(deltaX, deltaY) < PAN_SLOP_PX) return
    const overflows = host.scrollWidth > host.clientWidth || host.scrollHeight > host.clientHeight
    if (!overflows) return
    isPanning.value = true
    host.setPointerCapture(event.pointerId)
  }

  host.scrollLeft = panOrigin.scrollLeft - deltaX
  host.scrollTop = panOrigin.scrollTop - deltaY
}

function endPan(event: PointerEvent): void {
  if (panPointerId !== event.pointerId) return
  if (isPanning.value) viewport.value?.releasePointerCapture(event.pointerId)
  panPointerId = null
  isPanning.value = false
}

/** Double-click between the turn zones toggles a close look. */
function handleDoubleClick(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('button')) return
  zoom.value = zoom.value === 1 ? 2 : 1
}

// =============================================================================
// Vertical residency
// =============================================================================

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

function attachPendingPages(): void {
  if (!viewport.value) return
  for (const element of pendingPages) attachPage(element)
  pendingPages.clear()
}

function attachPage(element: HTMLElement): void {
  ensurePageObservers()
  loadObserver?.observe(element)
  currentObserver?.observe(element)
}

function ensurePageObservers(): void {
  loadObserver ??= new IntersectionObserver(
    (entries) => {
      let changed = false
      for (const entry of entries) {
        const index = readPageIndex(entry.target)
        if (index === null) continue
        if (entry.isIntersecting) {
          if (!visiblePages.has(index)) {
            visiblePages.add(index)
            changed = true
          }
        } else if (visiblePages.delete(index)) {
          changed = true
        }
      }
      if (changed) void ensureVisiblePages()
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
      emit('pageChange', topmost, pageCount.value)
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

function disconnectPageObservers(): void {
  loadObserver?.disconnect()
  currentObserver?.disconnect()
  loadObserver = null
  currentObserver = null
  pendingPages.clear()
  visiblePages.clear()
}
</script>

<template>
  <div
    v-if="isEmpty"
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    {{ m.reader.image.emptyPages }}
  </div>

  <!-- Continuous vertical scroll -->
  <div
    v-else-if="isVertical"
    ref="viewport"
    class="h-full overflow-auto"
    @wheel="handleWheel"
  >
    <div class="flex w-max min-w-full flex-col items-center">
      <div
        v-for="index in verticalPages"
        :key="index"
        :ref="(element) => observePage(element as Element | null, index)"
        :style="verticalPageStyle(index)"
        class="flex min-h-16 items-center justify-center"
      >
        <img
          v-if="pages.get(index)"
          :src="pages.get(index)!.url"
          :style="verticalImageStyle(index)"
          class="h-full w-full select-none"
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
          {{ m.reader.image.pageLoadFailed }}
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
    @dblclick="handleDoubleClick"
  >
    <div
      :class="
        cn(
          'flex min-h-full w-max min-w-full items-center justify-center',
          isRtl ? 'flex-row-reverse' : 'flex-row'
        )
      "
    >
      <template
        v-for="index in currentPages"
        :key="index"
      >
        <img
          v-if="slotSizes.has(index)"
          :src="pages.get(index)!.url"
          :style="pagedStyle(index)"
          class="select-none"
          decoding="async"
          draggable="false"
          :alt="String(index + 1)"
        />
        <div
          v-else-if="failedPages.has(index)"
          class="flex h-full items-center justify-center px-8 text-sm text-muted-foreground"
        >
          {{ m.reader.image.pageLoadFailed }}
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
