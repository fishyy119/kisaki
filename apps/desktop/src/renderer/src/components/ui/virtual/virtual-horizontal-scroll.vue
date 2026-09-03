<!--
  VirtualHorizontalScroll - Virtualized horizontal scroll with dynamic measurement

  Features:
  - Dynamic item width measurement from the first rendered item
  - Horizontal virtual scrolling on its own container
  - Scroll navigation controls (scrollLeft/scrollRight)

  @example
  ```vue
  <VirtualHorizontalScroll :items="games" @scroll-state-change="handleScroll">
    <template #item="{ item }">
      <GameCard :game="item" size="md" />
    </template>
  </VirtualHorizontalScroll>
  ```
-->
<script setup lang="ts" generic="T">
import { ref, computed, onMounted, watch, nextTick, type HTMLAttributes } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = withDefaults(
  defineProps<{
    /** Items to render */
    items: T[]
    /** Custom key extractor, defaults to index */
    getKey?: (item: T, index: number) => string | number
    /** Container class - defaults to flex with gap */
    class?: HTMLAttributes['class']
    /** Overscan count for virtualizer */
    overscan?: number
  }>(),
  {
    getKey: undefined,
    class: 'flex gap-3',
    overscan: 3
  }
)

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

// Horizontal virtualizer
const virtualizer = useVirtualizer(
  computed(() => ({
    horizontal: true,
    count: props.items.length,
    getScrollElement: () => containerRef.value ?? null,
    estimateSize: () => measuredItemWidth.value + measuredGap.value,
    overscan: props.overscan
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
}

// Update scroll state
function updateScrollState() {
  const element = containerRef.value
  if (!element) return

  const { scrollLeft, scrollWidth, clientWidth } = element
  canScrollLeft.value = scrollLeft > 1
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1

  emit('scrollStateChange', {
    canScrollLeft: canScrollLeft.value,
    canScrollRight: canScrollRight.value
  })
}

// Scroll navigation methods
function scrollLeft() {
  containerRef.value?.scrollBy({ left: -containerRef.value.clientWidth * 0.8, behavior: 'smooth' })
}

function scrollRight() {
  containerRef.value?.scrollBy({ left: containerRef.value.clientWidth * 0.8, behavior: 'smooth' })
}

function scrollToIndex(index: number, options?: { align?: 'start' | 'center' | 'end' }) {
  virtualizer.value.scrollToIndex(index, options)
}

onMounted(() => {
  measureLayout()
  updateScrollState()
})

useEventListener(containerRef, 'scroll', updateScrollState, { passive: true })

useResizeObserver(containerRef, () => {
  measureLayout()
  updateScrollState()
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
    class="relative overflow-x-auto scrollbar-hide"
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
          transform: `translateX(${virtualItem.start}px)`
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
