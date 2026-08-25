<!--
Novel reading shell: text volumes reflow through foliate, fixed-layout PDF
volumes page through the same engine comics use.
Boundary: it reports locators and fractions; read state lives in the main process.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ReaderNovelBootstrap, ReaderNovelUnit } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
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
import { createLogger } from '@renderer/core/log'
import { cn } from '@renderer/utils/cn'
import {
  closeReaderWindow,
  reportNovelProgress,
  reportUnitOpened
} from '@renderer/core/reader/bridge'
import {
  buildNovelContentStyles,
  createFoliateView,
  openNovelVolume,
  type FoliateRelocation,
  type FoliateTocItem,
  type FoliateView
} from '@renderer/core/reader/foliate'
import { createNovelPdfPageSource, type PageSource } from '@renderer/core/reader/page-source'
import { formatPageLocator, parsePageLocator } from '@renderer/core/reader/locators'
import { useReaderToolbar } from '@renderer/composables/use-reader-toolbar'
import PageEngine from './page-engine.vue'
import ReaderShortcuts from './reader-shortcuts.vue'

const props = defineProps<{ bootstrap: ReaderNovelBootstrap }>()

const log = createLogger('Reader')
const { m } = useI18n()
const { toolbarVisible, wakeToolbar } = useReaderToolbar()

const FONT_SIZE_STORAGE_KEY = 'kisaki-reader-font-size'
const FONT_SIZE_MIN = 75
const FONT_SIZE_MAX = 175
const FONT_SIZE_STEP = 10

const host = ref<HTMLElement | null>(null)
const engine = ref<InstanceType<typeof PageEngine> | null>(null)
const currentUnitId = ref('')
const opening = ref(true)
const openError = ref(false)
const progressPercent = ref<number | null>(null)
const currentLocation = ref('')
const fontSizePercent = ref(readStoredFontSize())
const pageIndex = ref(0)

const view = shallowRef<FoliateView | null>(null)
const pageSource = shallowRef<PageSource | null>(null)
let openToken = 0

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
const flatToc = computed(() => flattenToc(toc.value))

onMounted(() => {
  void openUnit(props.bootstrap.startUnitId)
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

watch(fontSizePercent, (value) => {
  localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(value))
  view.value?.renderer.setStyles?.(buildNovelContentStyles(value))
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
  progressPercent.value = null
  currentLocation.value = ''
  pageIndex.value = 0
  toc.value = []
  openError.value = false
  closeCurrentUnit()
  reportUnitOpened(unitId)
  updateWindowTitle()

  if (!target.fileId) {
    opening.value = false
    return
  }

  opening.value = true
  try {
    if (target.container === 'pdf') await openFixedLayoutVolume(target, token)
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

async function openFixedLayoutVolume(target: ReaderNovelUnit, token: number): Promise<void> {
  const source = await createNovelPdfPageSource(target.fileId as string)
  if (token !== openToken) {
    source.dispose()
    return
  }
  pageSource.value = source
}

async function openTextVolume(target: ReaderNovelUnit, token: number): Promise<void> {
  const nextView = await createFoliateView()
  if (token !== openToken) return

  view.value = nextView
  nextView.classList.add('h-full', 'w-full')
  nextView.addEventListener('relocate', ((event: CustomEvent<FoliateRelocation>) => {
    handleRelocate(target.id, event.detail)
  }) as EventListener)
  host.value?.append(nextView)

  await openNovelVolume(nextView, target)
  if (token !== openToken) return

  nextView.renderer.setStyles?.(buildNovelContentStyles(fontSizePercent.value))
  toc.value = nextView.book.toc ?? []

  await nextView.init(
    target.resumeLocator && !target.read
      ? { lastLocation: target.resumeLocator }
      : { showTextStart: true }
  )
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
  progressPercent.value = fraction === null ? null : Math.round(fraction * 100)
  currentLocation.value = location.tocItem?.label?.trim() ?? ''

  if (fraction !== null && location.cfi) {
    reportNovelProgress({ volumeId, locator: location.cfi, progress: fraction })
  }
  updateWindowTitle()
}

function handlePageChange(index: number, total: number): void {
  pageIndex.value = index
  const progress = total > 0 ? (index + 1) / total : 0
  progressPercent.value = Math.round(progress * 100)
  reportNovelProgress({
    volumeId: currentUnitId.value,
    locator: formatPageLocator(index),
    progress
  })
  updateWindowTitle()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

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
    case '[':
      openPreviousUnitAction()
      break
    case ']':
      openNextUnitAction()
      break
    case 'Escape':
      closeReaderWindow()
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

function goToTocItem(href: string): void {
  void view.value?.goTo(href)
}

function adjustFontSize(delta: number): void {
  fontSizePercent.value = Math.min(
    FONT_SIZE_MAX,
    Math.max(FONT_SIZE_MIN, fontSizePercent.value + delta)
  )
}

function readStoredFontSize(): number {
  const raw = Number.parseInt(localStorage.getItem(FONT_SIZE_STORAGE_KEY) ?? '', 10)
  return Number.isFinite(raw) && raw >= FONT_SIZE_MIN && raw <= FONT_SIZE_MAX ? raw : 100
}

function flattenToc(
  items: FoliateTocItem[],
  depth = 0
): Array<{ label: string; href: string; depth: number }> {
  const output: Array<{ label: string; href: string; depth: number }> = []
  for (const item of items) {
    output.push({ label: item.label?.trim() || item.href, href: item.href, depth })
    if (item.subitems?.length) {
      output.push(...flattenToc(item.subitems, depth + 1))
    }
  }
  return output
}

function updateWindowTitle(): void {
  const parts = [props.bootstrap.title]
  const label = unit.value?.label
  if (label) parts.push(label)
  document.title = parts.join(' · ')
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
          'absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border',
          'bg-surface px-3 py-2 transition-transform duration-200',
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
          <SelectValue :placeholder="m.reader.units.novelLabel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="entry in units"
            :key="entry.id"
            :value="entry.id"
            :disabled="!entry.fileId"
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

      <DropdownMenu v-if="!isFixedLayout">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.reader.novel.toc"
          >
            <Icon
              icon="icon-[mdi--table-of-contents]"
              class="size-4"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          class="max-h-96 w-72 overflow-y-auto"
        >
          <DropdownMenuItem
            v-for="item in flatToc"
            :key="`${item.href}-${item.depth}`"
            @click="goToTocItem(item.href)"
          >
            <span
              class="truncate"
              :style="{ paddingLeft: `${item.depth * 12}px` }"
            >
              {{ item.label }}
            </span>
          </DropdownMenuItem>
          <div
            v-if="flatToc.length === 0"
            class="px-2 py-1.5 text-xs text-muted-foreground"
          >
            {{ m.reader.novel.emptyToc }}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="ml-auto flex items-center gap-1">
        <span
          v-if="currentLocation"
          class="mr-1 max-w-48 truncate text-xs text-muted-foreground"
          :title="currentLocation"
        >
          {{ currentLocation }}
        </span>
        <span
          v-if="isFixedLayout"
          class="mr-2 text-xs tabular-nums text-muted-foreground"
        >
          {{ pageIndex + 1 }} / {{ pageCount ?? '?' }}
        </span>
        <span
          v-else-if="progressPercent !== null"
          class="mr-2 text-xs tabular-nums text-muted-foreground"
        >
          {{ m.reader.novel.progress({ percent: progressPercent }) }}
        </span>

        <template v-if="!isFixedLayout">
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.reader.novel.fontSizeDecrease"
            :disabled="fontSizePercent <= FONT_SIZE_MIN"
            @click="adjustFontSize(-FONT_SIZE_STEP)"
          >
            <Icon
              icon="icon-[mdi--format-font-size-decrease]"
              class="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.reader.novel.fontSizeIncrease"
            :disabled="fontSizePercent >= FONT_SIZE_MAX"
            @click="adjustFontSize(FONT_SIZE_STEP)"
          >
            <Icon
              icon="icon-[mdi--format-font-size-increase]"
              class="size-4"
            />
          </Button>
        </template>

        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.reader.units.previous"
          :disabled="!previousUnit"
          @click="openPreviousUnitAction"
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
          @click="openNextUnitAction"
        >
          <Icon
            icon="icon-[mdi--skip-next]"
            class="size-4"
          />
        </Button>

        <ReaderShortcuts :paged="isFixedLayout" />

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
        @page-change="handlePageChange"
      />

      <!-- Reflowable volume -->
      <div
        v-else
        ref="host"
        class="h-full"
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
    </template>
  </div>
</template>
