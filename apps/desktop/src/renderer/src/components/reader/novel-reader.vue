<!-- Novel text engine: foliate-view host with TOC, font size, and unit switching. -->
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
import { useReaderToolbar } from '@renderer/composables/use-reader-toolbar'

const props = defineProps<{ bootstrap: ReaderNovelBootstrap }>()

const log = createLogger('Reader')
const { m } = useI18n()
const { toolbarVisible, wakeToolbar } = useReaderToolbar()

const FONT_SIZE_STORAGE_KEY = 'kisaki-reader-font-size'
const FONT_SIZE_MIN = 75
const FONT_SIZE_MAX = 175
const FONT_SIZE_STEP = 10

const host = ref<HTMLElement | null>(null)
const currentUnitId = ref('')
const opening = ref(true)
const openError = ref(false)
const progressPercent = ref<number | null>(null)
const currentLocation = ref('')
const fontSizePercent = ref(readStoredFontSize())

const view = shallowRef<FoliateView | null>(null)
let openToken = 0

const units = computed(() => props.bootstrap.units)
const unit = computed(
  () => units.value.find((entry) => entry.id === currentUnitId.value) ?? null
)
const unitIndex = computed(() => units.value.findIndex((entry) => entry.id === currentUnitId.value))
const nextUnit = computed<ReaderNovelUnit | null>(() => {
  for (let index = unitIndex.value + 1; index < units.value.length; index += 1) {
    const candidate = units.value[index]
    if (candidate.fileId && candidate.supported) return candidate
  }
  return null
})
const previousUnit = computed<ReaderNovelUnit | null>(() => {
  for (let index = unitIndex.value - 1; index >= 0; index -= 1) {
    const candidate = units.value[index]
    if (candidate.fileId && candidate.supported) return candidate
  }
  return null
})

const readable = computed(() => Boolean(unit.value?.fileId && unit.value.supported))
const toc = ref<FoliateTocItem[]>([])
const flatToc = computed(() => flattenToc(toc.value))

onMounted(() => {
  void openUnit(props.bootstrap.startUnitId, { report: false })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  destroyView()
})

watch(
  () => props.bootstrap,
  (next) => {
    void openUnit(next.startUnitId, { report: false })
  }
)

watch(fontSizePercent, (value) => {
  localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(value))
  view.value?.renderer.setStyles?.(buildNovelContentStyles(value))
})

async function openUnit(unitId: string, options: { report: boolean } = { report: true }): Promise<void> {
  const target = units.value.find((entry) => entry.id === unitId)
  if (!target) return

  currentUnitId.value = unitId
  progressPercent.value = null
  currentLocation.value = ''
  toc.value = []
  openError.value = false
  updateWindowTitle()

  if (options.report) {
    reportUnitOpened(unitId)
  }

  if (!target.fileId || !target.supported) {
    destroyView()
    opening.value = false
    return
  }

  const token = ++openToken
  opening.value = true
  destroyView()

  try {
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
  } catch (error) {
    if (token === openToken) {
      openError.value = true
      log.error('Failed to open the novel volume.', error)
    }
  } finally {
    if (token === openToken) {
      opening.value = false
    }
  }
}

function destroyView(): void {
  const current = view.value
  if (!current) return
  try {
    current.close()
  } catch {
    // The engine throws when closing a view that never finished opening.
  }
  current.remove()
  view.value = null
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

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

  switch (event.key) {
    case 'ArrowLeft':
      void view.value?.goLeft()
      break
    case 'ArrowRight':
      void view.value?.goRight()
      break
    case ' ':
    case 'PageDown':
      void view.value?.renderer.next()
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
          <SelectValue :placeholder="m.reader.units.novelLabel" />
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

      <DropdownMenu>
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
          v-if="progressPercent !== null"
          class="mr-2 text-xs tabular-nums text-muted-foreground"
        >
          {{ m.reader.novel.progress({ percent: progressPercent }) }}
        </span>

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

    <template v-else>
      <!-- Engine host -->
      <div
        ref="host"
        class="h-full pt-0"
      />

      <div
        v-if="opening"
        class="absolute inset-0 z-10 flex items-center justify-center bg-background/60"
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
  </div>
</template>
