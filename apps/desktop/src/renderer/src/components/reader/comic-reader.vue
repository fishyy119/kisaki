<!-- Comic paging engine: paged rtl/ltr and vertical scroll over book:// pages. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import type { ReaderComicBootstrap, ReaderComicUnit } from '@shared/reader'
import { buildComicPageUrl } from '@shared/book'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import {
  closeReaderWindow,
  reportComicProgress,
  reportUnitOpened
} from '@renderer/core/reader/bridge'
import { useReaderToolbar } from '@renderer/composables/use-reader-toolbar'

const props = defineProps<{ bootstrap: ReaderComicBootstrap }>()

const { m } = useI18n()
const { toolbarVisible, wakeToolbar } = useReaderToolbar()

const currentUnitId = ref('')
const flow = ref<ComicReadingDirection>('ltr')
const fitWidth = ref(false)
const pageIndex = ref(0)
const pageFailed = ref(false)
const pageLoading = ref(false)
const endReached = ref(false)

const scrollHost = ref<HTMLElement | null>(null)

const units = computed(() => props.bootstrap.units)
const unit = computed(
  () => units.value.find((entry) => entry.id === currentUnitId.value) ?? null
)
const unitIndex = computed(() => units.value.findIndex((entry) => entry.id === currentUnitId.value))
const nextUnit = computed<ReaderComicUnit | null>(() => {
  for (let index = unitIndex.value + 1; index < units.value.length; index += 1) {
    const candidate = units.value[index]
    if (candidate.fileId && candidate.supported) return candidate
  }
  return null
})
const previousUnit = computed<ReaderComicUnit | null>(() => {
  for (let index = unitIndex.value - 1; index >= 0; index -= 1) {
    const candidate = units.value[index]
    if (candidate.fileId && candidate.supported) return candidate
  }
  return null
})

const pageCount = computed(() => unit.value?.pageCount ?? null)
const pageTotalLabel = computed(() => (pageCount.value === null ? '?' : String(pageCount.value)))
const readable = computed(() => Boolean(unit.value?.fileId && unit.value.supported))
const isVertical = computed(() => flow.value === 'vertical')

/** Pages of the vertical layout; unknown totals fall back to the paged mode. */
const verticalPages = computed(() => {
  const total = pageCount.value
  const fileId = unit.value?.fileId
  if (!fileId || total === null) return []
  return Array.from({ length: total }, (_, index) => ({
    index,
    url: buildComicPageUrl(fileId, index)
  }))
})

const currentPageUrl = computed(() => {
  const fileId = unit.value?.fileId
  return fileId ? buildComicPageUrl(fileId, pageIndex.value) : ''
})

const flowOptions = computed(() => [
  { value: 'rtl' as const, label: m.value.reader.comic.pageFlowRtl },
  { value: 'ltr' as const, label: m.value.reader.comic.pageFlowLtr },
  { value: 'vertical' as const, label: m.value.reader.comic.pageFlowVertical }
])

watch(
  () => props.bootstrap,
  (next) => {
    flow.value = next.pageFlow
    openUnit(next.startUnitId, { report: false })
  }
)

onMounted(() => {
  flow.value = props.bootstrap.pageFlow
  openUnit(props.bootstrap.startUnitId, { report: false })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function openUnit(unitId: string, options: { report: boolean } = { report: true }): void {
  const target = units.value.find((entry) => entry.id === unitId)
  if (!target) return

  currentUnitId.value = unitId
  endReached.value = false
  pageFailed.value = false
  setPage(target.read ? 0 : (target.resumePage ?? 0))

  if (options.report) {
    reportUnitOpened(unitId)
  }
  updateWindowTitle()
}

function setPage(index: number): void {
  const total = pageCount.value
  const clamped = Math.max(0, total === null ? index : Math.min(index, Math.max(0, total - 1)))
  pageIndex.value = clamped
  pageLoading.value = true
  pageFailed.value = false

  const currentUnit = unit.value
  if (currentUnit) {
    reportComicProgress({
      chapterId: currentUnit.id,
      pageIndex: clamped,
      pageCount: total ?? 0
    })
  }

  preloadNeighbors(clamped)
  updateWindowTitle()

  if (isVertical.value) {
    scrollToPage(clamped)
  }
}

function nextPage(): void {
  const total = pageCount.value
  if (total !== null && pageIndex.value >= total - 1) {
    endReached.value = true
    return
  }
  setPage(pageIndex.value + 1)
}

function previousPage(): void {
  if (endReached.value) {
    endReached.value = false
    return
  }
  if (pageIndex.value > 0) setPage(pageIndex.value - 1)
}

/** Screen-side navigation: which side means "forward" depends on the flow. */
function turnLeft(): void {
  if (flow.value === 'rtl') nextPage()
  else previousPage()
}

function turnRight(): void {
  if (flow.value === 'rtl') previousPage()
  else nextPage()
}

function openNextUnit(): void {
  if (nextUnit.value) openUnit(nextUnit.value.id)
}

function openPreviousUnit(): void {
  if (previousUnit.value) openUnit(previousUnit.value.id)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

  switch (event.key) {
    case 'ArrowLeft':
      turnLeft()
      break
    case 'ArrowRight':
      turnRight()
      break
    case ' ':
    case 'PageDown':
      nextPage()
      break
    case 'PageUp':
      previousPage()
      break
    case 'Home':
      setPage(0)
      break
    case 'End':
      if (pageCount.value !== null) setPage(pageCount.value - 1)
      break
    case '[':
      openPreviousUnit()
      break
    case ']':
      openNextUnit()
      break
    case 'Escape':
      closeReaderWindow()
      break
    default:
      return
  }
  event.preventDefault()
}

function handleWheel(event: WheelEvent): void {
  if (isVertical.value) return
  if (event.deltaY > 0) nextPage()
  else if (event.deltaY < 0) previousPage()
}

function handlePageError(): void {
  pageLoading.value = false
  pageFailed.value = true
}

function handlePageLoaded(): void {
  pageLoading.value = false
}

/** Adjacent pages decode ahead of the turn, so paging never flashes. */
function preloadNeighbors(index: number): void {
  const fileId = unit.value?.fileId
  const total = pageCount.value
  if (!fileId || isVertical.value) return

  for (const neighbor of [index + 1, index + 2, index - 1]) {
    if (neighbor < 0 || (total !== null && neighbor >= total)) continue
    const image = new Image()
    image.src = buildComicPageUrl(fileId, neighbor)
  }
}

function scrollToPage(index: number): void {
  requestAnimationFrame(() => {
    const host = scrollHost.value
    const target = host?.querySelector<HTMLElement>(`[data-page-index="${index}"]`)
    target?.scrollIntoView({ block: 'start' })
  })
}

/** Vertical mode reads position from the page closest to the viewport top. */
function handleVerticalScroll(): void {
  const host = scrollHost.value
  if (!host || !isVertical.value) return

  const hostTop = host.getBoundingClientRect().top
  let closest = pageIndex.value
  let closestDistance = Number.POSITIVE_INFINITY
  for (const element of host.querySelectorAll<HTMLElement>('[data-page-index]')) {
    const distance = Math.abs(element.getBoundingClientRect().top - hostTop)
    if (distance < closestDistance) {
      closestDistance = distance
      closest = Number.parseInt(element.dataset.pageIndex ?? '0', 10)
    }
  }

  if (closest === pageIndex.value) return
  pageIndex.value = closest
  const currentUnit = unit.value
  if (currentUnit) {
    reportComicProgress({
      chapterId: currentUnit.id,
      pageIndex: closest,
      pageCount: pageCount.value ?? 0
    })
  }
  updateWindowTitle()
}

watch(flow, (next, previous) => {
  if (next === 'vertical') {
    scrollToPage(pageIndex.value)
  } else if (previous === 'vertical') {
    setPage(pageIndex.value)
  }
})

function updateWindowTitle(): void {
  const label = unit.value?.label
  document.title = label ? `${props.bootstrap.title} · ${label}` : props.bootstrap.title
}
</script>

<template>
  <div
    class="relative flex h-full flex-col overflow-hidden bg-background"
    @mousemove="wakeToolbar"
  >
    <!-- Toolbar -->
    <div
      :class="
        cn(
          'absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border/60',
          'bg-surface/90 px-3 py-2 backdrop-blur transition-transform duration-200',
          toolbarVisible ? 'translate-y-0' : '-translate-y-full'
        )
      "
    >
      <span
        class="truncate text-sm font-medium"
        :title="bootstrap.title"
      >
        {{ bootstrap.title }}
      </span>

      <Select
        :model-value="currentUnitId"
        @update:model-value="(value) => typeof value === 'string' && openUnit(value)"
      >
        <SelectTrigger
          size="sm"
          class="ml-2 w-56 shrink-0"
        >
          <SelectValue :placeholder="m.reader.units.comicLabel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="entry in units"
            :key="entry.id"
            :value="entry.id"
            :disabled="!entry.fileId || !entry.supported"
          >
            <span class="flex items-center gap-2">
              <span class="truncate">{{ entry.label }}</span>
              <span
                v-if="entry.read"
                class="text-xs text-muted-foreground"
              >
                {{ m.reader.units.readBadge }}
              </span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="ml-auto flex items-center gap-1">
        <span class="mr-2 text-xs tabular-nums text-muted-foreground">
          {{ pageIndex + 1 }} / {{ pageTotalLabel }}
        </span>

        <Select
          :model-value="flow"
          @update:model-value="(value) => typeof value === 'string' && (flow = value as ComicReadingDirection)"
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

        <Button
          v-if="!isVertical"
          variant="ghost"
          size="icon-sm"
          :tooltip="fitWidth ? m.reader.comic.fitHeight : m.reader.comic.fitWidth"
          @click="fitWidth = !fitWidth"
        >
          <Icon
            :icon="fitWidth ? 'icon-[mdi--arrow-expand-vertical]' : 'icon-[mdi--arrow-expand-horizontal]'"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.units.previous"
          :disabled="!previousUnit"
          @click="openPreviousUnit"
        >
          <Icon
            icon="icon-[mdi--skip-previous]"
            class="size-4"
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.units.next"
          :disabled="!nextUnit"
          @click="openNextUnit"
        >
          <Icon
            icon="icon-[mdi--skip-next]"
            class="size-4"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.close"
          @click="closeReaderWindow"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-4"
          />
        </Button>
      </div>
    </div>

    <!-- Unreadable unit -->
    <div
      v-if="!readable"
      class="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground"
    >
      {{ unit?.fileId ? m.reader.units.unsupportedFile : m.reader.units.noFile }}
    </div>

    <!-- Vertical scroll layout -->
    <div
      v-else-if="isVertical"
      ref="scrollHost"
      class="h-full overflow-y-auto"
      @scroll.passive="handleVerticalScroll"
    >
      <div class="mx-auto flex max-w-4xl flex-col">
        <img
          v-for="page in verticalPages"
          :key="page.index"
          :src="page.url"
          :data-page-index="page.index"
          loading="lazy"
          decoding="async"
          class="w-full select-none"
          draggable="false"
          :alt="`${page.index + 1}`"
        />
        <div
          v-if="verticalPages.length === 0"
          class="flex h-full items-center justify-center py-24 text-sm text-muted-foreground"
        >
          {{ m.reader.comic.emptyPages }}
        </div>
        <div
          v-if="nextUnit && verticalPages.length > 0"
          class="flex justify-center py-10"
        >
          <Button
            variant="outline"
            @click="openNextUnit"
          >
            {{ m.comic.readNext }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Paged layout -->
    <div
      v-else
      class="relative flex h-full items-center justify-center overflow-hidden"
      @wheel.passive="handleWheel"
    >
      <img
        v-if="!pageFailed"
        :src="currentPageUrl"
        :class="
          cn(
            'select-none',
            fitWidth ? 'h-auto w-full object-contain' : 'h-full w-auto max-w-full object-contain'
          )
        "
        draggable="false"
        :alt="`${pageIndex + 1}`"
        @load="handlePageLoaded"
        @error="handlePageError"
      />
      <div
        v-else
        class="text-sm text-muted-foreground"
      >
        {{ m.reader.comic.pageLoadFailed }}
      </div>
      <Spinner
        v-if="pageLoading && !pageFailed"
        class="absolute bottom-4 right-4 size-4 text-muted-foreground"
      />

      <!-- Click zones -->
      <button
        type="button"
        class="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize opacity-0"
        :aria-label="m.reader.shortcuts.turnPage"
        @click="turnLeft"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 z-10 w-1/3 cursor-e-resize opacity-0"
        :aria-label="m.reader.shortcuts.turnPage"
        @click="turnRight"
      />

      <!-- End-of-unit overlay -->
      <div
        v-if="endReached"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm"
      >
        <span class="text-sm text-muted-foreground">
          {{ nextUnit ? m.reader.comic.nextChapterHint : m.reader.units.lastUnit }}
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
            {{ m.comic.readNext }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
