<!--
  VirtualHorizontalScroll - Virtualized horizontal scroll with dynamic measurement

  Features:
  - Dynamic item width measurement from the first rendered item
  - Horizontal virtual scrolling
  - Scroll navigation controls (scrollLeft/scrollRight)
  - Remembers its horizontal offset under the enclosing region's identity
    when given a `memoryKey`

  @example
  ```vue
  <VirtualHorizontalScroll :items="games" memory-key="recent" @scroll-state-change="handleScroll">
    <template #item="{ item }">
      <GameCard :game="item" size="md" />
    </template>
  </VirtualHorizontalScroll>
  ```
-->
<script setup lang="ts" generic="T">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
  toRef,
  type HTMLAttributes
} from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { cn } from '@renderer/utils/cn'
import {
  nestedScrollIdentity,
  readScrollMemory,
  useOptionalScrollRegion,
  writeScrollMemory
} from '@renderer/components/ui/scroll-region'
import { useVirtualScrollParent, type VirtualScrollParent } from './use-virtual-scroll-parent'

const props = withDefaults(
  defineProps<{
    /** Items to render */
    items: T[]
    /** Custom key extractor, defaults to index */
    getKey?: (item: T, index: number) => string | number
    /** External scroll parent: 'region' for the enclosing ScrollRegion, or an element */
    scrollParent?: VirtualScrollParent
    /**
     * Local key of this row inside the enclosing region. With a key and a
     * region that has an identity, the row remembers its horizontal offset
     * under `<region identity>#<key>`; without either, it does not remember.
     */
    memoryKey?: string
    /** Container class - defaults to flex with gap */
    class?: HTMLAttributes['class']
    /** Overscan count for virtualizer */
    overscan?: number
  }>(),
  {
    getKey: undefined,
    scrollParent: null,
    memoryKey: undefined,
    class: 'flex gap-3',
    overscan: 3
  }
)

// Memory identity: the enclosing region's identity plus this row's key.
const region = useOptionalScrollRegion()
const memoryIdentity = computed(() => {
  const parent = region?.identity.value
  return parent !== undefined && props.memoryKey !== undefined
    ? nestedScrollIdentity(parent, props.memoryKey)
    : undefined
})

const emit = defineEmits<{
  /** Scroll state change event */
  scrollStateChange: [{ canScrollLeft: boolean; canScrollRight: boolean }]
}>()

defineSlots<{
  /** Item slot - receives item and index */
  item: (props: { item: T; index: number }) => void
  /** Empty state slot */
  empty?: () => void
}>()

// Refs
const containerRef = ref<HTMLDivElement>()
const rowsRef = ref<HTMLDivElement>()

// State
const measuredItemWidth = ref(128)
const measuredItemHeight = ref(0)
const measuredGap = ref(12)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

// Scroll parent integration (must be before virtualizer to provide getScrollElement and scrollMargin)
const { scrollMargin, resolvedParent, getScrollElement, initialOffset, notifyLayoutChange } =
  useVirtualScrollParent({
    containerRef,
    scrollParent: toRef(props, 'scrollParent'),
    horizontal: true,
    onMeasure: () => virtualizer.value.measure(),
    onResize: () => {
      measureLayout()
      updateScrollState()
    }
  })

// A self-scrolling row enters at its remembered offset; the virtualizer
// renders for it on the first frame and scrolls its own element there when
// it attaches.
function rowInitialOffset(): number {
  if (resolvedParent.value || !memoryIdentity.value) return initialOffset()
  return readScrollMemory(memoryIdentity.value) ?? 0
}

// Horizontal virtualizer
const virtualizer = useVirtualizer(
  computed(() => ({
    horizontal: true,
    count: props.items.length,
    getScrollElement,
    initialOffset: rowInitialOffset,
    estimateSize: () => measuredItemWidth.value + measuredGap.value,
    overscan: props.overscan,
    scrollMargin: scrollMargin.value
  }))
)

/**
 * Measure item dimensions from the first rendered item and the gap from the
 * rows container, which carries the caller's layout class (children are
 * absolutely positioned, so the class only contributes its gap value).
 */
async function measureLayout() {
  if (props.items.length === 0) return

  await nextTick()

  const rows = rowsRef.value
  // Measure the slot content, not the positioning wrapper around it
  const firstItem = rows?.firstElementChild?.firstElementChild as HTMLElement | null
  if (!rows || !firstItem) return

  measuredItemWidth.value = firstItem.offsetWidth
  measuredItemHeight.value = firstItem.offsetHeight

  const computedStyle = getComputedStyle(rows)
  measuredGap.value = parseFloat(computedStyle.columnGap) || parseFloat(computedStyle.gap) || 0

  virtualizer.value.measure()
  notifyLayoutChange()
}

// Update scroll state
function updateScrollState() {
  const element = getScrollElement()
  if (!element) return

  const { scrollLeft, scrollWidth, clientWidth } = element
  canScrollLeft.value = scrollLeft > 1
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1

  emit('scrollStateChange', {
    canScrollLeft: canScrollLeft.value,
    canScrollRight: canScrollRight.value
  })
}

// Only the element's own scroll events write memory: a mount-time state read
// happens before the virtualizer has scrolled the row to its remembered offset.
function handleScroll() {
  updateScrollState()
  const element = getScrollElement()
  if (element && memoryIdentity.value && !resolvedParent.value) {
    writeScrollMemory(memoryIdentity.value, element.scrollLeft)
  }
}

// Scroll navigation methods
function scrollLeft() {
  const element = getScrollElement()
  if (!element) return

  const scrollAmount = element.clientWidth * 0.8
  element.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
}

function scrollRight() {
  const element = getScrollElement()
  if (!element) return

  const scrollAmount = element.clientWidth * 0.8
  element.scrollBy({ left: scrollAmount, behavior: 'smooth' })
}

function scrollToIndex(index: number, options?: { align?: 'start' | 'center' | 'end' }) {
  virtualizer.value.scrollToIndex(index, options)
}

// Setup scroll listener
let scrollCleanup: (() => void) | null = null

onMounted(() => {
  measureLayout()
  updateScrollState()

  const element = getScrollElement()
  if (element) {
    element.addEventListener('scroll', handleScroll, { passive: true })
    scrollCleanup = () => element.removeEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  scrollCleanup?.()
})

// Re-measure when items change
watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen === oldLen || newLen === 0) return
    measureLayout()
    updateScrollState()
  }
)

// Expose methods
defineExpose({
  scrollLeft,
  scrollRight,
  scrollToIndex,
  canScrollLeft,
  canScrollRight,
  virtualizer,
  measuredItemWidth,
  measuredItemHeight
})
</script>

<template>
  <div
    ref="containerRef"
    :class="cn(!resolvedParent && 'overflow-x-auto scrollbar-hide', 'relative')"
    :style="{
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      height: measuredItemHeight > 0 ? `${measuredItemHeight}px` : undefined
    }"
  >
    <slot
      v-if="props.items.length === 0"
      name="empty"
    />

    <!-- Virtual list container; the class supplies the gap being measured -->
    <div
      v-else
      ref="rowsRef"
      :class="props.class"
      :style="{
        width: `${virtualizer.getTotalSize()}px`,
        height: '100%',
        position: 'relative'
      }"
    >
      <div
        v-for="virtualItem in virtualizer.getVirtualItems()"
        :key="
          props.getKey?.(props.items[virtualItem.index]!, virtualItem.index) ??
          String(virtualItem.key)
        "
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          transform: `translateX(${virtualItem.start - scrollMargin}px)`
        }"
      >
        <slot
          name="item"
          :item="props.items[virtualItem.index]!"
          :index="virtualItem.index"
        />
      </div>
    </div>
  </div>
</template>
