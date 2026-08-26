<!-- Comic reading shell: unit switching and layout controls around the page engine. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ComicBookmark } from '@shared/db'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import type { ReaderComicBootstrap, ReaderComicUnit } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { useReaderChrome, type ReaderPanelTab } from '@renderer/composables/use-reader-chrome'
import { useReadingClock } from '@renderer/composables/use-reading-clock'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import {
  closeReaderWindow,
  reportComicProgress,
  reportUnitOpened
} from '@renderer/core/reader/bridge'
import { buildComicFilter } from '@renderer/core/reader/display'
import { isEditableTarget } from '@renderer/core/reader/keys'
import {
  deleteComicBookmark,
  fetchComicBookmarks,
  toggleComicBookmark,
  updateComicBookmark
} from '@renderer/core/reader/marks'
import type { ReaderOutlineEntry } from '@renderer/core/reader/outline'
import {
  createComicPdfPageSource,
  createContainerPageSource,
  type PageSource
} from '@renderer/core/reader/page-source'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import NavPanel from './chrome/nav-panel.vue'
import ProgressFooter from './chrome/progress-footer.vue'
import ReaderToolbar from './chrome/toolbar.vue'
import type { ReaderNavUnit, ReaderProgress } from './chrome/types'
import BookmarkList from './comic/bookmark-list.vue'
import DisplayPopover from './comic/display-popover.vue'
import ThumbnailGrid from './comic/thumbnail-grid.vue'
import PageEngine from './page-engine.vue'

const props = defineProps<{ bootstrap: ReaderComicBootstrap }>()

const log = createLogger('Reader')
const { m } = useI18n()
const { fullScreen, panelOpen, panelTab, toggleFullScreen, exitFullScreen, togglePanel } =
  useReaderChrome()
const { elapsedMinutes } = useReadingClock()
const { comicDisplay, autoCrop } = storeToRefs(useReaderSettingsStore())

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

const PANEL_TABS: ReaderPanelTab[] = ['outline', 'pages', 'marks']

const engine = ref<InstanceType<typeof PageEngine> | null>(null)
const currentUnitId = ref('')
const flow = ref<ComicReadingDirection>('ltr')
const spread = ref(false)
const coverAlone = ref(true)
const fitWidth = ref(false)
const zoom = ref(1)
const pageIndex = ref(0)
const endReached = ref(false)
const openError = ref(false)
const outline = ref<ReaderOutlineEntry[]>([])
const jumpOpen = ref(false)
const bookmarks = ref<ComicBookmark[]>([])

const source = shallowRef<PageSource | null>(null)
let sourceToken = 0

const units = computed(() => props.bootstrap.units)
const unit = computed(() => units.value.find((entry) => entry.id === currentUnitId.value) ?? null)
const unitIndex = computed(() => units.value.findIndex((entry) => entry.id === currentUnitId.value))
const nextUnit = computed<ReaderComicUnit | null>(() => findReadable(1))
const previousUnit = computed<ReaderComicUnit | null>(() => findReadable(-1))

const pageCount = computed(() => source.value?.pageCount ?? unit.value?.pageCount ?? null)
const readable = computed(() => Boolean(unit.value?.fileId))
const isVertical = computed(() => flow.value === 'vertical')
const isRtl = computed(() => flow.value === 'rtl')

const navUnits = computed<ReaderNavUnit[]>(() =>
  units.value.map((entry) => ({
    id: entry.id,
    label: entry.label,
    read: entry.read,
    readable: Boolean(entry.fileId)
  }))
)

const progress = computed<ReaderProgress>(() => ({
  kind: 'page',
  pageIndex: pageIndex.value,
  pageCount: pageCount.value,
  rtl: isRtl.value
}))

const pageFilter = computed(() => buildComicFilter(comicDisplay.value))

const unitLabels = computed<Record<string, string>>(() =>
  Object.fromEntries(units.value.map((entry) => [entry.id, entry.label]))
)

/** Spreads mark their leading page, so the button reflects the page in hand. */
const currentPageMarked = computed(() =>
  bookmarks.value.some(
    (bookmark) =>
      bookmark.chapterId === currentUnitId.value && bookmark.pageIndex === pageIndex.value
  )
)

const flowOptions = computed(() => [
  { value: 'rtl' as const, label: m.value.reader.comic.pageFlowRtl },
  { value: 'ltr' as const, label: m.value.reader.comic.pageFlowLtr },
  { value: 'vertical' as const, label: m.value.reader.comic.pageFlowVertical }
])

onMounted(() => {
  flow.value = props.bootstrap.pageFlow
  void openUnit(props.bootstrap.startUnitId)
  void loadBookmarks()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  disposeSource()
})

// A read request for an entry already open re-aims this window through a new
// bootstrap; the reported unit keeps the reading session in step.
watch(
  () => props.bootstrap,
  (next) => {
    flow.value = next.pageFlow
    void openUnit(next.startUnitId)
  }
)

function findReadable(step: number): ReaderComicUnit | null {
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

  // Invalidated first: a source still resolving must not replace this one.
  const token = ++sourceToken

  currentUnitId.value = unitId
  endReached.value = false
  openError.value = false
  zoom.value = 1
  outline.value = []
  disposeSource()
  reportUnitOpened(unitId)
  updateWindowTitle()

  if (!target.fileId) return

  try {
    const next = await createPageSource(target)
    if (token !== sourceToken) {
      next.dispose()
      return
    }
    source.value = next

    const entries = await next.getOutline()
    if (token === sourceToken) outline.value = entries
  } catch (error) {
    if (token !== sourceToken) return
    openError.value = true
    log.error('Failed to open the comic unit.', error)
  }
}

function createPageSource(target: ReaderComicUnit): Promise<PageSource> {
  const fileId = target.fileId
  if (!fileId) throw new Error('Comic unit has no readable file')

  return target.container === 'pdf'
    ? createComicPdfPageSource(fileId)
    : Promise.resolve(createContainerPageSource(fileId, target.pageCount))
}

function disposeSource(): void {
  source.value?.dispose()
  source.value = null
}

/** The engine reports where the reader is; the page number is only shown. */
function handlePageChange(index: number, total: number): void {
  pageIndex.value = index
  endReached.value = false
  reportComicProgress({ chapterId: currentUnitId.value, pageIndex: index, pageCount: total })
  updateWindowTitle()
}

function startPage(): number {
  const target = unit.value
  if (!target || target.read) return 0
  return target.resumePage ?? 0
}

function openNextUnit(): void {
  if (nextUnit.value) void openUnit(nextUnit.value.id)
}

function openPreviousUnit(): void {
  if (previousUnit.value) void openUnit(previousUnit.value.id)
}

function adjustZoom(delta: number): void {
  zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((zoom.value + delta).toFixed(2))))
}

/** Comic outlines address pages, so every destination is a page index. */
function goToOutline(target: string | number): void {
  if (typeof target === 'number') engine.value?.setPage(target)
}

async function loadBookmarks(): Promise<void> {
  try {
    bookmarks.value = await fetchComicBookmarks(props.bootstrap.comicId)
  } catch (error) {
    log.warn('Failed to load comic bookmarks.', error)
  }
}

/** Marking the page in hand, or clearing the mark it already carries. */
async function toggleCurrentPageBookmark(): Promise<void> {
  if (!currentUnitId.value) return

  try {
    const created = await toggleComicBookmark({
      chapterId: currentUnitId.value,
      pageIndex: pageIndex.value,
      note: null
    })
    await loadBookmarks()
    // In full screen the page itself shows nothing of this, so say it happened.
    notify.success(
      created ? m.value.reader.marks.bookmarkAdded : m.value.reader.marks.bookmarkRemoved
    )
  } catch (error) {
    log.error('Failed to mark a comic page.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

async function openBookmark(chapterId: string, page: number): Promise<void> {
  if (chapterId !== currentUnitId.value) await openUnit(chapterId)
  engine.value?.setPage(page)
}

async function editBookmarkNote(id: string, note: string | null): Promise<void> {
  try {
    await updateComicBookmark(id, { note })
    await loadBookmarks()
  } catch (error) {
    log.error('Failed to update a comic bookmark.', error)
    notify.error(m.value.reader.marks.failed)
  }
}

async function removeBookmark(id: string): Promise<void> {
  try {
    await deleteComicBookmark(id)
    await loadBookmarks()
  } catch (error) {
    log.error('Failed to remove a comic bookmark.', error)
    notify.error(m.value.reader.marks.failed)
  }
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
      engine.value?.turnLeft()
      break
    case 'ArrowRight':
      engine.value?.turnRight()
      break
    case ' ':
    case 'PageDown':
      engine.value?.next()
      break
    case 'PageUp':
      engine.value?.previous()
      break
    case 'Home':
      engine.value?.setPage(0)
      break
    case 'End':
      if (pageCount.value !== null) engine.value?.setPage(pageCount.value - 1)
      break
    case '+':
    case '=':
      adjustZoom(ZOOM_STEP)
      break
    case '-':
      adjustZoom(-ZOOM_STEP)
      break
    case '0':
      zoom.value = 1
      break
    case '[':
      openPreviousUnit()
      break
    case ']':
      openNextUnit()
      break
    case 'g':
    case 'G':
      revealChrome()
      jumpOpen.value = true
      break
    case 'b':
    case 'B':
      void toggleCurrentPageBookmark()
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
    case 'f':
    case 'F':
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

function updateWindowTitle(): void {
  const label = unit.value?.label
  document.title = label ? `${props.bootstrap.title} · ${label}` : props.bootstrap.title
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
      paged
      :zoomable="!isVertical"
      :searchable="false"
      @toggle-panel="togglePanel"
      @previous-unit="openPreviousUnit"
      @next-unit="openNextUnit"
      @toggle-full-screen="toggleFullScreen"
    >
      <template #controls>
        <Select
          :model-value="flow"
          @update:model-value="
            (value) => typeof value === 'string' && (flow = value as ComicReadingDirection)
          "
        >
          <SelectTrigger
            size="sm"
            class="w-32"
            :tooltip="m.reader.comic.pageFlow"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in flowOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <template v-if="!isVertical">
          <Button
            :variant="spread ? 'secondary' : 'ghost'"
            size="icon-sm"
            :tooltip="m.reader.comic.spread"
            @click="spread = !spread"
          >
            <Icon
              icon="icon-[mdi--book-open-page-variant-outline]"
              class="size-4"
            />
          </Button>
          <Button
            v-if="spread"
            :variant="coverAlone ? 'secondary' : 'ghost'"
            size="icon-sm"
            :tooltip="m.reader.comic.coverAlone"
            @click="coverAlone = !coverAlone"
          >
            <Icon
              icon="icon-[mdi--page-layout-sidebar-left]"
              class="size-4"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="fitWidth ? m.reader.comic.fitHeight : m.reader.comic.fitWidth"
            @click="fitWidth = !fitWidth"
          >
            <Icon
              :icon="
                fitWidth
                  ? 'icon-[mdi--arrow-expand-vertical]'
                  : 'icon-[mdi--arrow-expand-horizontal]'
              "
              class="size-4"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.reader.comic.zoomOut"
            :disabled="zoom <= ZOOM_MIN"
            @click="adjustZoom(-ZOOM_STEP)"
          >
            <Icon
              icon="icon-[mdi--magnify-minus-outline]"
              class="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.reader.comic.zoomIn"
            :disabled="zoom >= ZOOM_MAX"
            @click="adjustZoom(ZOOM_STEP)"
          >
            <Icon
              icon="icon-[mdi--magnify-plus-outline]"
              class="size-4"
            />
          </Button>
        </template>

        <DisplayPopover />

        <Button
          :variant="currentPageMarked ? 'secondary' : 'ghost'"
          size="icon-sm"
          :tooltip="m.reader.marks.addBookmark"
          :disabled="!readable"
          @click="toggleCurrentPageBookmark"
        >
          <Icon
            :icon="currentPageMarked ? 'icon-[mdi--bookmark]' : 'icon-[mdi--bookmark-outline]'"
            class="size-4"
          />
        </Button>
      </template>
    </ReaderToolbar>

    <div class="flex min-h-0 flex-1">
      <NavPanel
        v-if="!fullScreen && panelOpen"
        v-model:tab="panelTab"
        :tabs="PANEL_TABS"
        :units="navUnits"
        :current-unit-id="currentUnitId"
        :unit-label="m.reader.units.comicLabel"
        :outline="outline"
        @open-unit="openUnit"
        @go-to-outline="goToOutline"
      >
        <template #pages>
          <ThumbnailGrid
            :source="source"
            :current-page="pageIndex"
            @select="(index) => engine?.setPage(index)"
          />
        </template>

        <template #marks>
          <BookmarkList
            :bookmarks="bookmarks"
            :source="source"
            :current-unit-id="currentUnitId"
            :unit-labels="unitLabels"
            @open="openBookmark"
            @update-note="editBookmarkNote"
            @remove="removeBookmark"
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

        <div
          v-else-if="openError"
          class="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground"
        >
          {{ m.reader.comic.openFailed }}
        </div>

        <PageEngine
          v-else
          ref="engine"
          :source="source"
          :flow="flow"
          :spread="spread"
          :cover-alone="coverAlone"
          :fit-width="fitWidth"
          :zoom="zoom"
          :start-page="startPage()"
          :filter="pageFilter"
          :auto-crop="autoCrop"
          @page-change="handlePageChange"
          @end-reached="endReached = true"
        >
          <template #vertical-footer>
            <div
              v-if="nextUnit"
              class="flex justify-center py-10"
            >
              <Button
                variant="outline"
                @click="openNextUnit"
              >
                {{ m.reader.units.next }}
              </Button>
            </div>
          </template>
        </PageEngine>

        <!-- End-of-unit overlay -->
        <div
          v-if="endReached"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background"
        >
          <span class="text-sm text-muted-foreground">
            {{ nextUnit ? m.reader.comic.nextUnitHint : m.reader.units.lastUnit }}
          </span>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="endReached = false"
            >
              {{ m.reader.units.endOfUnit }}
            </Button>
            <Button
              v-if="nextUnit"
              size="sm"
              @click="openNextUnit"
            >
              {{ m.reader.units.next }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <ProgressFooter
      v-if="!fullScreen"
      v-model:jump-open="jumpOpen"
      :progress="progress"
      :elapsed-minutes="elapsedMinutes"
      @seek="(value) => engine?.setPage(value)"
    />
  </div>
</template>
