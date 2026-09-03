<!-- Comic reading shell: unit switching and the marks model around the image engine. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ComicBookmark } from '@shared/db'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import type { ReaderBootstrap, ReaderUnit } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { useReaderChrome, type ReaderPanelTab } from '@renderer/composables/use-reader-chrome'
import { useReadingClock } from '@renderer/composables/use-reading-clock'
import { useReadingUnits } from '@renderer/composables/use-reading-units'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { closeReaderWindow, reportPageFlow, reportProgress } from '@renderer/core/reader/bridge'
import { buildPageFilter } from '@renderer/core/reader/image/display'
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@renderer/core/reader/image/layout'
import {
  createComicPdfPageSource,
  createContainerPageSource,
  type PageSource
} from '@renderer/core/reader/image/source'
import { isEditableTarget } from '@renderer/core/reader/keys'
import {
  deleteComicBookmark,
  fetchComicBookmarks,
  toggleComicBookmark,
  updateComicBookmark
} from '@renderer/core/reader/marks'
import type { ReaderOutlineEntry } from '@renderer/core/reader/outline'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import NavPanel from './chrome/nav-panel.vue'
import ProgressFooter from './chrome/progress-footer.vue'
import ReaderToolbar from './chrome/toolbar.vue'
import type { ReaderProgress } from './chrome/types'
import ComicBookmarkList from './comic-bookmark-list.vue'
import PageEngine from './image/page-engine.vue'
import SettingsPopover from './image/settings-popover.vue'
import ThumbnailGrid from './image/thumbnail-grid.vue'

const props = defineProps<{ bootstrap: ReaderBootstrap }>()

const log = createLogger('Reader')
const { m } = useI18n()
const { fullScreen, panelOpen, panelTab, toggleFullScreen, exitFullScreen, togglePanel } =
  useReaderChrome()
const { elapsedMinutes } = useReadingClock()
const { pageDisplay, pageLayout, pageFit, autoCrop } = storeToRefs(useReaderSettingsStore())

const PANEL_TABS: ReaderPanelTab[] = ['outline', 'pages', 'marks']

const engine = ref<InstanceType<typeof PageEngine> | null>(null)
const pageFlow = ref<ComicReadingDirection>('ltr')
const zoom = ref(1)
const pageIndex = ref(0)
const endReached = ref(false)
const outline = ref<ReaderOutlineEntry[]>([])
const jumpOpen = ref(false)
const bookmarks = ref<ComicBookmark[]>([])

const source = shallowRef<PageSource | null>(null)

const {
  currentUnitId,
  unit,
  nextUnit,
  previousUnit,
  navUnits,
  opening,
  openError,
  openUnit,
  openNextUnit,
  openPreviousUnit
} = useReadingUnits(() => props.bootstrap, {
  reset: () => {
    endReached.value = false
    zoom.value = 1
    pageIndex.value = 0
    outline.value = []
    disposeSource()
  },
  open: async (target, isCurrent) => {
    const next = await createPageSource(target)
    if (!isCurrent()) {
      next.dispose()
      return
    }
    source.value = next

    const entries = await next.getOutline()
    if (isCurrent()) outline.value = entries
  }
})

const pageCount = computed(() => source.value?.pageCount ?? null)
const readable = computed(() => Boolean(unit.value?.fileId))
const isRtl = computed(() => pageFlow.value === 'rtl')

const progress = computed<ReaderProgress>(() => ({
  kind: 'page',
  pageIndex: pageIndex.value,
  pageCount: pageCount.value,
  rtl: isRtl.value
}))

const pageFilter = computed(() => buildPageFilter(pageDisplay.value))

const unitLabels = computed<Record<string, string>>(() =>
  Object.fromEntries(props.bootstrap.units.map((entry) => [entry.id, entry.label]))
)

/** Spreads mark their leading page, so the button reflects the page in hand. */
const currentPageMarked = computed(() =>
  bookmarks.value.some(
    (bookmark) =>
      bookmark.chapterId === currentUnitId.value && bookmark.pageIndex === pageIndex.value
  )
)

// The effective flow arrives resolved with each bootstrap; a re-aim resolves
// it again, so a persisted override comes back as itself.
watch(
  () => props.bootstrap,
  (next) => {
    pageFlow.value = next.pageFlow
  },
  { immediate: true }
)

onMounted(() => {
  void loadBookmarks()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  disposeSource()
})

function createPageSource(target: ReaderUnit): Promise<PageSource> {
  const fileId = target.fileId
  if (!fileId) throw new Error('Comic unit has no readable file')

  return target.container === 'pdf'
    ? createComicPdfPageSource(fileId)
    : createContainerPageSource(fileId)
}

function disposeSource(): void {
  source.value?.dispose()
  source.value = null
}

/** The engine reports where the reader is; the page number is only shown. */
function handlePageChange(index: number, total: number): void {
  pageIndex.value = index
  endReached.value = false
  reportProgress({
    unitId: currentUnitId.value,
    position: { kind: 'page', index },
    extent: total
  })
}

function startPage(): number {
  const target = unit.value
  if (!target || target.read) return 0
  return target.resume?.kind === 'page' ? target.resume.index : 0
}

/** The chosen flow becomes the entry override, so it survives reopening. */
function handlePageFlowChange(value: ComicReadingDirection): void {
  pageFlow.value = value
  reportPageFlow(value)
}

function adjustZoom(delta: number): void {
  zoom.value = clampZoom(zoom.value + delta)
}

/** Comic outlines address pages, so every destination is a page index. */
function goToOutline(target: string | number): void {
  if (typeof target === 'number') engine.value?.setPage(target)
}

async function loadBookmarks(): Promise<void> {
  try {
    bookmarks.value = await fetchComicBookmarks(props.bootstrap.entryId)
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
      zoomable
      :searchable="false"
      @toggle-panel="togglePanel"
      @previous-unit="openPreviousUnit"
      @next-unit="openNextUnit"
      @toggle-full-screen="toggleFullScreen"
    >
      <template #controls>
        <SettingsPopover
          :page-flow="pageFlow"
          @update:page-flow="handlePageFlowChange"
        />

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.image.zoomOut"
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
          :tooltip="m.reader.image.zoomIn"
          :disabled="zoom >= ZOOM_MAX"
          @click="adjustZoom(ZOOM_STEP)"
        >
          <Icon
            icon="icon-[mdi--magnify-plus-outline]"
            class="size-4"
          />
        </Button>

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

    <!-- The row is the container the nav panel docks or floats against -->
    <div class="@container relative flex min-h-0 flex-1">
      <div
        v-if="!fullScreen && panelOpen"
        class="absolute inset-0 z-10 hidden @max-2xl:block"
        aria-hidden="true"
        @click="togglePanel"
      />
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
          <ComicBookmarkList
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
          {{ m.reader.units.openFailed }}
        </div>

        <template v-else>
          <PageEngine
            ref="engine"
            v-model:zoom="zoom"
            :source="source"
            :page-flow="pageFlow"
            :page-layout="pageLayout"
            :fit="pageFit"
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

          <div
            v-if="opening"
            class="absolute inset-0 z-10 flex items-center justify-center bg-background"
          >
            <Spinner class="size-5 text-muted-foreground" />
          </div>
        </template>

        <!-- End-of-unit overlay -->
        <div
          v-if="endReached"
          class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background"
        >
          <span class="text-sm text-muted-foreground">
            {{ nextUnit ? m.reader.units.nextUnitHint : m.reader.units.lastUnit }}
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
