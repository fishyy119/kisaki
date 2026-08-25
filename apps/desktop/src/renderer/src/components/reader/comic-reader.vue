<!-- Comic reading shell: unit switching and layout controls around the page engine. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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
import { createLogger } from '@renderer/core/log'
import { cn } from '@renderer/utils/cn'
import {
  closeReaderWindow,
  reportComicProgress,
  reportUnitOpened
} from '@renderer/core/reader/bridge'
import {
  createComicPdfPageSource,
  createContainerPageSource,
  type PageSource
} from '@renderer/core/reader/page-source'
import { useReaderToolbar } from '@renderer/composables/use-reader-toolbar'
import PageEngine from './page-engine.vue'
import ReaderShortcuts from './reader-shortcuts.vue'

const props = defineProps<{ bootstrap: ReaderComicBootstrap }>()

const log = createLogger('Reader')
const { m } = useI18n()
const { toolbarVisible, wakeToolbar } = useReaderToolbar()

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

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

const source = shallowRef<PageSource | null>(null)
let sourceToken = 0

const units = computed(() => props.bootstrap.units)
const unit = computed(() => units.value.find((entry) => entry.id === currentUnitId.value) ?? null)
const unitIndex = computed(() => units.value.findIndex((entry) => entry.id === currentUnitId.value))
const nextUnit = computed<ReaderComicUnit | null>(() => findReadable(1))
const previousUnit = computed<ReaderComicUnit | null>(() => findReadable(-1))

const pageCount = computed(() => source.value?.pageCount ?? unit.value?.pageCount ?? null)
const pageTotalLabel = computed(() => (pageCount.value === null ? '?' : String(pageCount.value)))
const readable = computed(() => Boolean(unit.value?.fileId))
const isVertical = computed(() => flow.value === 'vertical')

const flowOptions = computed(() => [
  { value: 'rtl' as const, label: m.value.reader.comic.pageFlowRtl },
  { value: 'ltr' as const, label: m.value.reader.comic.pageFlowLtr },
  { value: 'vertical' as const, label: m.value.reader.comic.pageFlowVertical }
])

onMounted(() => {
  flow.value = props.bootstrap.pageFlow
  void openUnit(props.bootstrap.startUnitId)
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

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

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
    case 'Escape':
      closeReaderWindow()
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
          <SelectValue :placeholder="m.reader.units.comicLabel" />
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

      <div class="ml-auto flex items-center gap-1">
        <span class="mr-2 text-xs tabular-nums text-muted-foreground">
          {{ pageIndex + 1 }} / {{ pageTotalLabel }}
        </span>

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

        <ReaderShortcuts :paged="!isVertical" />

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
</template>
