<!--
Novel reading shell: text volumes reflow through foliate, fixed-layout PDF
volumes page through the same engine comics use.
Boundary: it reports locators and fractions; read state lives in the main process.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { NovelBookmark, NovelHighlight } from '@shared/db'
import type { HighlightColor } from '@shared/db/contracts/enums'
import type { ReaderNovelBootstrap, ReaderNovelUnit } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { useReaderChrome, type ReaderPanelTab } from '@renderer/composables/use-reader-chrome'
import { useReadingClock } from '@renderer/composables/use-reading-clock'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import {
  closeReaderWindow,
  reportNovelProgress,
  reportUnitOpened
} from '@renderer/core/reader/bridge'
import {
  createFoliateView,
  createFootnoteHandler,
  loadHighlightDraw,
  openNovelVolume,
  type FoliateDrawRequest,
  type FoliateLoadDetail,
  type FoliateRelocation,
  type FoliateSearchResult,
  type FoliateShowAnnotationDetail,
  type FoliateTocItem,
  type FoliateView
} from '@renderer/core/reader/foliate'
import { HIGHLIGHT_TINTS, resolveSearchTint } from '@renderer/core/reader/highlight'
import { isEditableTarget } from '@renderer/core/reader/keys'
import {
  createNovelBookmark,
  createNovelHighlight,
  deleteNovelBookmark,
  deleteNovelHighlight,
  fetchNovelBookmarks,
  fetchNovelHighlights,
  updateNovelBookmark,
  updateNovelHighlight
} from '@renderer/core/reader/marks'
import { flattenTocOutline, type ReaderOutlineEntry } from '@renderer/core/reader/outline'
import { createNovelPdfPageSource, type PageSource } from '@renderer/core/reader/page-source'
import { formatPageLocator, parsePageLocator } from '@renderer/core/reader/locators'
import {
  applyNovelLayout,
  buildNovelContentStyles,
  READER_PAGE_TINTS
} from '@renderer/core/reader/typography'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import { useThemeStore } from '@renderer/stores/theme'
import NavPanel from './chrome/nav-panel.vue'
import ProgressFooter from './chrome/progress-footer.vue'
import ReaderToolbar from './chrome/toolbar.vue'
import type { ReaderNavUnit, ReaderProgress } from './chrome/types'
import FootnoteDialog from './novel/footnote-dialog.vue'
import MarksPanel from './novel/marks-panel.vue'
import SearchPanel from './novel/search-panel.vue'
import SelectionMenu from './novel/selection-menu.vue'
import TypographyPopover from './novel/typography-popover.vue'
import PageEngine from './page-engine.vue'

const props = defineProps<{ bootstrap: ReaderNovelBootstrap }>()

/** A passage the reader has selected, already resolved to a stable position. */
interface TextSelection {
  cfi: string
  text: string
  progress: number
}

const log = createLogger('Reader')
const { m } = useI18n()
const {
  fullScreen,
  panelOpen,
  panelTab,
  toggleFullScreen,
  exitFullScreen,
  togglePanel,
  openPanel
} = useReaderChrome()
const { elapsedMinutes } = useReadingClock()
const { typography } = storeToRefs(useReaderSettingsStore())
const { resolvedTheme } = storeToRefs(useThemeStore())

/** Enough of a passage to recognize it, short enough for a two-line row. */
const BOOKMARK_EXCERPT_LENGTH = 80

const host = ref<HTMLElement | null>(null)
const engine = ref<InstanceType<typeof PageEngine> | null>(null)
const currentUnitId = ref('')
const opening = ref(true)
const openError = ref(false)
const progressFraction = ref(0)
const currentLocation = ref('')
const pageIndex = ref(0)
const sectionFractions = ref<number[]>([])
const pdfOutline = ref<ReaderOutlineEntry[]>([])
const jumpOpen = ref(false)
const footnoteContent = shallowRef<HTMLElement | null>(null)
const footnoteOpen = ref(false)
const bookmarks = ref<NovelBookmark[]>([])
const highlights = ref<NovelHighlight[]>([])
const selectedMarkId = ref<string | null>(null)
const selection = ref<TextSelection | null>(null)

const view = shallowRef<FoliateView | null>(null)
const pageSource = shallowRef<PageSource | null>(null)
let openToken = 0
let footnoteHandlerPromise: ReturnType<typeof createFootnoteHandler> | null = null

const units = computed(() => props.bootstrap.units)
const unit = computed(() => units.value.find((entry) => entry.id === currentUnitId.value) ?? null)
const unitIndex = computed(() => units.value.findIndex((entry) => entry.id === currentUnitId.value))
const nextUnit = computed<ReaderNovelUnit | null>(() => findReadable(1))
const previousUnit = computed<ReaderNovelUnit | null>(() => findReadable(-1))

const readable = computed(() => Boolean(unit.value?.fileId))
/** PDF volumes carry no reflowable text, so they page instead of reflowing. */
const isFixedLayout = computed(() => unit.value?.container === 'pdf')
const pageCount = computed(() => pageSource.value?.pageCount ?? null)
const toc = ref<FoliateTocItem[]>([])

const navUnits = computed<ReaderNavUnit[]>(() =>
  units.value.map((entry) => ({
    id: entry.id,
    label: entry.label,
    read: entry.read,
    readable: Boolean(entry.fileId)
  }))
)

/** Only reflowable text can be searched; a PDF volume has no text layer here. */
const panelTabs = computed<ReaderPanelTab[]>(() =>
  isFixedLayout.value ? ['outline', 'marks'] : ['outline', 'search', 'marks']
)

/** Highlights of the open volume, the only ones the view can draw. */
const volumeHighlights = computed(() =>
  highlights.value.filter((highlight) => highlight.volumeId === currentUnitId.value)
)

const outline = computed<ReaderOutlineEntry[]>(() =>
  isFixedLayout.value ? pdfOutline.value : flattenTocOutline(toc.value)
)

const progress = computed<ReaderProgress>(() =>
  isFixedLayout.value
    ? { kind: 'page', pageIndex: pageIndex.value, pageCount: pageCount.value, rtl: false }
    : {
        kind: 'fraction',
        fraction: progressFraction.value,
        sectionFractions: sectionFractions.value,
        section: currentLocation.value
      }
)

/** A fixed tint paints its own margins; the app theme paints them with tokens. */
const tintStyle = computed(() => {
  const tint = typography.value.tint
  if (tint === 'theme') return undefined
  const colors = READER_PAGE_TINTS[tint]
  return { backgroundColor: colors.background, color: colors.foreground }
})

onMounted(() => {
  void openUnit(props.bootstrap.startUnitId)
  void loadMarks()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  closeCurrentUnit()
})

// A read request for an entry already open re-aims this window through a new
// bootstrap; the reported unit keeps the reading session in step.
watch(
  () => props.bootstrap,
  (next) => {
    void openUnit(next.startUnitId)
  }
)

// The app theme is a live input to the reading surface, so a theme change
// re-injects the book's styles alongside a typography change.
watch([typography, resolvedTheme], applyTypography)

// Volumes differ in what they can offer, so a panel page can disappear under
// the reader when the open volume changes.
watch(panelTabs, (tabs) => {
  if (!tabs.includes(panelTab.value)) panelTab.value = 'outline'
})

// Calling out a mark answers "which one did I just click"; once the marks are
// out of sight the question is gone, so the callout does not outlive it.
watch([panelOpen, panelTab], ([isOpen, tab]) => {
  if (!isOpen || tab !== 'marks') selectedMarkId.value = null
})

function findReadable(step: number): ReaderNovelUnit | null {
  for (
    let index = unitIndex.value + step;
    index >= 0 && index < units.value.length;
    index += step
  ) {
    const candidate = units.value[index]
    if (candidate.fileId) return candidate
  }
  return null
}

async function openUnit(unitId: string): Promise<void> {
  const target = units.value.find((entry) => entry.id === unitId)
  if (!target) return

  // Invalidated first: an open still in flight must not adopt this unit's view.
  const token = ++openToken

  currentUnitId.value = unitId
  progressFraction.value = 0
  currentLocation.value = ''
  pageIndex.value = 0
  toc.value = []
  pdfOutline.value = []
  sectionFractions.value = []
  openError.value = false
  closeCurrentUnit()
  reportUnitOpened(unitId)
  updateWindowTitle()

  const fileId = target.fileId
  if (!fileId) {
    opening.value = false
    return
  }

  opening.value = true
  try {
    if (target.container === 'pdf') await openFixedLayoutVolume(fileId, token)
    else await openTextVolume(target, token)
  } catch (error) {
    if (token === openToken) {
      openError.value = true
      log.error('Failed to open the novel volume.', error)
    }
  } finally {
    if (token === openToken) opening.value = false
  }
}

async function openFixedLayoutVolume(fileId: string, token: number): Promise<void> {
  const source = await createNovelPdfPageSource(fileId)
  if (token !== openToken) {
    source.dispose()
    return
  }
  pageSource.value = source

  const entries = await source.getOutline()
  if (token === openToken) pdfOutline.value = entries
}

async function openTextVolume(target: ReaderNovelUnit, token: number): Promise<void> {
  const nextView = await createFoliateView()
  if (token !== openToken) return

  view.value = nextView
  nextView.classList.add('h-full', 'w-full')
  nextView.addEventListener('relocate', ((event: CustomEvent<FoliateRelocation>) => {
    handleRelocate(target.id, event.detail)
  }) as EventListener)

  const footnotes = await ensureFootnoteHandler()
  if (token !== openToken) return
  // The `link` event is cancelable: the handler claims footnote references and
  // leaves ordinary links to navigate the book.
  nextView.addEventListener('link', (event) => {
    footnotes.handle(nextView.book, event)?.catch((error: unknown) => {
      log.warn('Failed to open a footnote.', error)
    })
  })

  const draw = await loadHighlightDraw()
  if (token !== openToken) return

  nextView.addEventListener('draw-annotation', (event) => {
    const detail = (event as CustomEvent<FoliateDrawRequest>).detail
    const highlight = volumeHighlights.value.find(
      (entry) => entry.locator === detail.annotation.value
    )
    detail.draw(draw, { color: HIGHLIGHT_TINTS[highlight?.color ?? 'yellow'] })
  })

  // A section can only be drawn on once its overlay exists, which happens as
  // the reader reaches it rather than when the marks were loaded.
  nextView.addEventListener('create-overlay', () => {
    drawHighlights()
  })

  nextView.addEventListener('show-annotation', (event) => {
    const { value } = (event as CustomEvent<FoliateShowAnnotationDetail>).detail
    const highlight = volumeHighlights.value.find((entry) => entry.locator === value)
    if (!highlight) return
    selectedMarkId.value = highlight.id
    openPanel('marks')
  })

  // Each section is laid out in its own document inside the engine. Selections
  // happen there, and so do keystrokes once the reader has clicked the page —
  // the engine never forwards those, so the shell listens for them itself.
  nextView.addEventListener('load', (event) => {
    const { doc, index } = (event as CustomEvent<FoliateLoadDetail>).detail
    // Appearing on release keeps the bar still while a selection is dragged out,
    // and collapsing is watched rather than inferred from a click: the browser
    // collapses the old selection after the pointer is already up, so a
    // pointer-driven dismissal would read the selection it is dismissing.
    doc.addEventListener('pointerup', () => captureSelection(nextView, doc, index))
    doc.addEventListener('selectionchange', () => {
      const active = doc.getSelection()
      if (!active || active.isCollapsed) selection.value = null
    })
    doc.addEventListener('keydown', handleKeydown)
  })

  host.value?.append(nextView)

  await openNovelVolume(nextView, target)
  if (token !== openToken) return

  applyTypography()
  toc.value = nextView.book.toc ?? []

  await nextView.init(
    target.resumeLocator && !target.read
      ? { lastLocation: target.resumeLocator }
      : { showTextStart: true }
  )
  if (token !== openToken) return

  // Section boundaries are only known once the book's progress index is built.
  sectionFractions.value = nextView.getSectionFractions()
  drawHighlights()
}

/** Re-asks the view to draw every highlight of the volume it has open. */
function drawHighlights(): void {
  const current = view.value
  if (!current) return
  for (const highlight of volumeHighlights.value) {
    void current.addAnnotation({ value: highlight.locator })
  }
}

function closeCurrentUnit(): void {
  const current = view.value
  if (current) {
    try {
      current.close()
    } catch {
      // The engine throws when closing a view that never finished opening.
    }
    current.remove()
    view.value = null
  }

  pageSource.value?.dispose()
  pageSource.value = null
}

/** Where a fixed-layout volume resumes; text volumes carry a CFI instead. */
function startPage(): number {
  const target = unit.value
  if (!target || target.read) return 0
  return parsePageLocator(target.resumeLocator) ?? 0
}

function handleRelocate(volumeId: string, location: FoliateRelocation): void {
  const fraction = typeof location.fraction === 'number' ? location.fraction : null
  progressFraction.value = fraction ?? 0
  currentLocation.value = location.tocItem?.label?.trim() ?? ''

  if (fraction !== null && location.cfi) {
    reportNovelProgress({ volumeId, locator: location.cfi, progress: fraction })
  }
  updateWindowTitle()
}

function handlePageChange(index: number, total: number): void {
  pageIndex.value = index
  const progressValue = total > 0 ? (index + 1) / total : 0
  progressFraction.value = progressValue
  reportNovelProgress({
    volumeId: currentUnitId.value,
    locator: formatPageLocator(index),
    progress: progressValue
  })
  updateWindowTitle()
}

/** Text volumes navigate by TOC href, fixed-layout ones by page index. */
function goToOutline(target: string | number): void {
  if (typeof target === 'number') engine.value?.setPage(target)
  else void view.value?.goTo(target)
}

/**
 * Opens a mark, following it into another volume when it belongs to one. The
 * locator's own shape says which engine has to resolve it.
 */
async function goToLocator(volumeId: string, locator: string): Promise<void> {
  // Going somewhere by choice replaces whatever the callout was pointing at.
  selectedMarkId.value = null
  if (volumeId !== currentUnitId.value) await openUnit(volumeId)

  const page = parsePageLocator(locator)
  if (page !== null) engine.value?.setPage(page)
  else await view.value?.goTo(locator)
}

function handleSeek(value: number): void {
  if (isFixedLayout.value) engine.value?.setPage(value)
  else void view.value?.goToFraction(value)
}

/**
 * Full screen renders no chrome, so an action that lives there would otherwise
 * do nothing at all; leaving full screen is the honest response.
 */
function revealChrome(): void {
  if (fullScreen.value) exitFullScreen()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || isEditableTarget(event.target)) return

  switch (event.key) {
    case 'ArrowLeft':
      if (isFixedLayout.value) engine.value?.turnLeft()
      else void view.value?.goLeft()
      break
    case 'ArrowRight':
      if (isFixedLayout.value) engine.value?.turnRight()
      else void view.value?.goRight()
      break
    case ' ':
    case 'PageDown':
      if (isFixedLayout.value) engine.value?.next()
      else void view.value?.renderer.next()
      break
    case 'PageUp':
      if (isFixedLayout.value) engine.value?.previous()
      break
    case 'Home':
      if (isFixedLayout.value) engine.value?.setPage(0)
      break
    case 'End':
      if (isFixedLayout.value && pageCount.value !== null) {
        engine.value?.setPage(pageCount.value - 1)
      }
      break
    case '[':
      openPreviousUnitAction()
      break
    case ']':
      openNextUnitAction()
      break
    case 'g':
    case 'G':
      if (!isFixedLayout.value) return
      revealChrome()
      jumpOpen.value = true
      break
    case 'f':
    case 'F':
      // Ctrl+F searches, a bare F toggles full screen.
      if (event.ctrlKey) {
        if (isFixedLayout.value) return
        revealChrome()
        openPanel('search')
      } else {
        toggleFullScreen()
      }
      break
    case 'b':
    case 'B':
      void addBookmark()
      break
    case 't':
    case 'T':
      if (fullScreen.value) {
        revealChrome()
        panelOpen.value = true
      } else {
        togglePanel()
      }
      break
    case 'F11':
      toggleFullScreen()
      break
    case 'Escape':
      // Full screen is a reading mode of its own, so leaving it comes before
      // leaving the book.
      if (fullScreen.value) exitFullScreen()
      else closeReaderWindow()
      break
    default:
      return
  }
  event.preventDefault()
}

function openNextUnitAction(): void {
  if (nextUnit.value) void openUnit(nextUnit.value.id)
}

function openPreviousUnitAction(): void {
  if (previousUnit.value) void openUnit(previousUnit.value.id)
}

/**
 * The footnote handler is stateless across volumes, so one instance serves the
 * whole window and every view opened in it attaches to the same listeners.
 */
function ensureFootnoteHandler(): ReturnType<typeof createFootnoteHandler> {
  footnoteHandlerPromise ??= createFootnoteHandler().then((handler) => {
    handler.addEventListener('before-render', (event) => {
      const fragment = (event as CustomEvent<{ view: FoliateView }>).detail.view
      fragment.classList.add('h-full', 'w-full')
      // A note is a short aside, so it scrolls instead of paginating.
      fragment.renderer.setAttribute('flow', 'scrolled')
      fragment.renderer.setStyles?.(buildNovelContentStyles(typography.value))
    })

    handler.addEventListener('render', (event) => {
      footnoteContent.value = (event as CustomEvent<{ view: HTMLElement }>).detail.view
      footnoteOpen.value = true
    })

    return handler
  })

  return footnoteHandlerPromise
}

function captureSelection(current: FoliateView, doc: Document, index: number): void {
  const active = doc.getSelection()
  const text = active?.toString().trim() ?? ''
  if (!active || active.isCollapsed || text === '') {
    selection.value = null
    return
  }

  selection.value = {
    cfi: current.getCFI(index, active.getRangeAt(0)),
    text,
    progress: progressFraction.value
  }
}

/** Drops the bar and the highlighted text under it together. */
function clearSelection(): void {
  selection.value = null
  view.value?.deselect()
}

async function loadMarks(): Promise<void> {
  try {
    const [loadedBookmarks, loadedHighlights] = await Promise.all([
      fetchNovelBookmarks(props.bootstrap.novelId),
      fetchNovelHighlights(props.bootstrap.novelId)
    ])
    bookmarks.value = loadedBookmarks
    highlights.value = loadedHighlights
    drawHighlights()
  } catch (error) {
    log.warn('Failed to load novel reading marks.', error)
  }
}

async function highlightSelection(color: HighlightColor): Promise<void> {
  const current = selection.value
  if (!current) return

  clearSelection()
  try {
    const created = await createNovelHighlight({
      volumeId: currentUnitId.value,
      locator: current.cfi,
      progress: current.progress,
      excerpt: current.text,
      color,
      note: null
    })
    highlights.value = [...highlights.value, created]
    // The passage changing color is the confirmation; no toast needed.
    void view.value?.addAnnotation({ value: created.locator })
  } catch (error) {
    log.error('Failed to highlight a passage.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

/**
 * Bookmarks the reading position.
 *
 * A bookmark is a place to come back to, so it always marks where the reader
 * is; marking a passage for its own sake is what a highlight is for.
 */
async function addBookmark(): Promise<void> {
  const locator = currentLocator()
  if (!locator) return

  try {
    const created = await createNovelBookmark({
      volumeId: currentUnitId.value,
      locator,
      progress: progressFraction.value,
      excerpt: readVisibleExcerpt() ?? (currentLocation.value || null),
      note: null
    })
    bookmarks.value = [...bookmarks.value, created]
    // Nothing on the page changes, so the toast is the only confirmation.
    notify.success(m.value.reader.marks.bookmarkAdded)
  } catch (error) {
    log.error('Failed to add a bookmark.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

/** Where the reader is now, in the form the open volume's engine uses. */
function currentLocator(): string | null {
  if (isFixedLayout.value) return formatPageLocator(pageIndex.value)
  return view.value?.lastLocation?.cfi ?? null
}

/**
 * Opening words of what is on screen, so a bookmark reads as the passage it
 * marks rather than as a chapter name shared with every other bookmark in it.
 * A fixed-layout volume has no text layer and answers null.
 */
function readVisibleExcerpt(): string | null {
  const text = view.value?.lastLocation?.range?.toString().replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > BOOKMARK_EXCERPT_LENGTH ? `${text.slice(0, BOOKMARK_EXCERPT_LENGTH)}…` : text
}

function copySelection(): void {
  const text = selection.value?.text
  clearSelection()
  if (!text) return
  void navigator.clipboard.writeText(text).catch((error: unknown) => {
    log.warn('Failed to copy the selected passage.', error)
  })
}

async function editBookmarkNote(id: string, note: string | null): Promise<void> {
  try {
    await updateNovelBookmark(id, { note })
    bookmarks.value = bookmarks.value.map((entry) => (entry.id === id ? { ...entry, note } : entry))
  } catch (error) {
    log.error('Failed to update a bookmark.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

async function editHighlight(
  id: string,
  updates: { note?: string | null; color?: HighlightColor }
): Promise<void> {
  try {
    await updateNovelHighlight(id, updates)
    highlights.value = highlights.value.map((entry) =>
      entry.id === id ? { ...entry, ...updates } : entry
    )
    // A recolored highlight is redrawn, so the text matches the list.
    if (updates.color) {
      const target = highlights.value.find((entry) => entry.id === id)
      if (target) void view.value?.addAnnotation({ value: target.locator })
    }
  } catch (error) {
    log.error('Failed to update a highlight.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

async function removeBookmark(id: string): Promise<void> {
  try {
    await deleteNovelBookmark(id)
    bookmarks.value = bookmarks.value.filter((entry) => entry.id !== id)
  } catch (error) {
    log.error('Failed to remove a bookmark.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

async function removeHighlight(id: string): Promise<void> {
  const target = highlights.value.find((entry) => entry.id === id)
  try {
    await deleteNovelHighlight(id)
    highlights.value = highlights.value.filter((entry) => entry.id !== id)
    if (target) void view.value?.deleteAnnotation({ value: target.locator })
  } catch (error) {
    log.error('Failed to remove a highlight.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

/** Book-wide search over the open volume; empty while no view is loaded. */
async function* runSearch(query: string): AsyncGenerator<FoliateSearchResult, void, undefined> {
  const current = view.value
  if (!current) return
  yield* current.search({ query, drawOptions: { color: resolveSearchTint(), width: 2 } })
}

function clearSearch(): void {
  view.value?.clearSearch()
}

/** Styles reach the book's own document, layout reaches the paginator. */
function applyTypography(): void {
  const current = view.value
  if (!current) return

  current.renderer.setStyles?.(buildNovelContentStyles(typography.value))
  applyNovelLayout(current.renderer, typography.value)
}

function updateWindowTitle(): void {
  const parts = [props.bootstrap.title]
  const label = unit.value?.label
  if (label) parts.push(label)
  document.title = parts.join(' · ')
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-background">
    <ReaderToolbar
      v-if="!fullScreen"
      :title="bootstrap.title"
      :panel-open="panelOpen"
      :has-previous-unit="Boolean(previousUnit)"
      :has-next-unit="Boolean(nextUnit)"
      :paged="isFixedLayout"
      :zoomable="false"
      :searchable="!isFixedLayout"
      @toggle-panel="togglePanel"
      @previous-unit="openPreviousUnitAction"
      @next-unit="openNextUnitAction"
      @toggle-full-screen="toggleFullScreen"
      @search="openPanel('search')"
    >
      <template #controls>
        <TypographyPopover v-if="!isFixedLayout" />

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.marks.addBookmark"
          :disabled="!readable"
          @click="addBookmark"
        >
          <Icon
            icon="icon-[mdi--bookmark-outline]"
            class="size-4"
          />
        </Button>
      </template>
    </ReaderToolbar>

    <div class="flex min-h-0 flex-1">
      <NavPanel
        v-if="!fullScreen && panelOpen"
        v-model:tab="panelTab"
        :tabs="panelTabs"
        :units="navUnits"
        :current-unit-id="currentUnitId"
        :unit-label="m.reader.units.novelLabel"
        :outline="outline"
        @open-unit="openUnit"
        @go-to-outline="goToOutline"
      >
        <template #search>
          <SearchPanel
            :run="runSearch"
            @go-to="(cfi) => view?.goTo(cfi)"
            @clear="clearSearch"
          />
        </template>

        <template #marks>
          <MarksPanel
            :bookmarks="bookmarks"
            :highlights="highlights"
            :selected-id="selectedMarkId"
            @go-to="goToLocator"
            @update-bookmark="editBookmarkNote"
            @update-highlight="editHighlight"
            @remove-bookmark="removeBookmark"
            @remove-highlight="removeHighlight"
          />
        </template>
      </NavPanel>

      <div class="relative min-w-0 flex-1 overflow-hidden">
        <!-- Unreadable unit -->
        <div
          v-if="!readable"
          class="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground"
        >
          {{ m.reader.units.noFile }}
        </div>

        <template v-else>
          <!-- Fixed-layout volume -->
          <PageEngine
            v-if="isFixedLayout"
            ref="engine"
            :source="pageSource"
            flow="ltr"
            :spread="false"
            :cover-alone="false"
            fit-width
            :zoom="1"
            :start-page="startPage()"
            filter="none"
            :auto-crop="false"
            @page-change="handlePageChange"
          />

          <!-- Reflowable volume -->
          <div
            v-else
            ref="host"
            class="h-full"
            :class="{ 'bg-background': typography.tint === 'theme' }"
            :style="tintStyle"
          />

          <div
            v-if="opening"
            class="absolute inset-0 z-10 flex items-center justify-center bg-background"
          >
            <Spinner class="size-5 text-muted-foreground" />
          </div>
          <div
            v-else-if="openError"
            class="absolute inset-0 z-10 flex items-center justify-center bg-background"
          >
            <span class="text-sm text-muted-foreground">{{ m.reader.novel.openFailed }}</span>
          </div>

          <!-- Edge navigation -->
          <template v-if="!isFixedLayout">
            <button
              type="button"
              class="absolute inset-y-14 left-0 z-10 w-12 cursor-w-resize opacity-0"
              :aria-label="m.reader.shortcuts.turnPage"
              @click="view?.goLeft()"
            />
            <button
              type="button"
              class="absolute inset-y-14 right-0 z-10 w-12 cursor-e-resize opacity-0"
              :aria-label="m.reader.shortcuts.turnPage"
              @click="view?.goRight()"
            />
          </template>

          <SelectionMenu
            v-if="selection"
            @highlight="highlightSelection"
            @copy="copySelection"
            @dismiss="clearSelection"
          />
        </template>
      </div>
    </div>

    <ProgressFooter
      v-if="!fullScreen"
      v-model:jump-open="jumpOpen"
      :progress="progress"
      :elapsed-minutes="elapsedMinutes"
      @seek="handleSeek"
    />

    <FootnoteDialog
      v-model:open="footnoteOpen"
      :content="footnoteContent"
    />
  </div>
</template>
