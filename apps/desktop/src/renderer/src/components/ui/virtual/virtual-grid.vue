<!--
  VirtualGrid - Virtualized grid with native CSS Grid layout

  Features:
  - Native CSS Grid layout (auto-fill, auto-fit, etc.)
  - Dynamic measurement taken from the first rendered row (no hidden copies)
  - Auto-detects column count from the resolved grid template
  - Scrolls inside the enclosing ScrollRegion ('region') or on its own

  @example
  ```vue
  <VirtualGrid :items="games" scroll-parent="region">
    <template #item="{ item }">
      <GameCard :game="item" />
    </template>
  </VirtualGrid>
  ```
-->
<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, nextTick, toRef, type HTMLAttributes } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { cn } from '@renderer/utils/cn'
import { useVirtualScrollParent, type VirtualScrollParent } from './use-virtual-scroll-parent'

const props = withDefaults(
  defineProps<{
    /** Items to render */
    items: T[]
    /** Custom key extractor, defaults to index */
    getKey?: (item: T, index: number) => string | number
    /** External scroll parent: 'region' for the enclosing ScrollRegion, or an element */
    scrollParent?: VirtualScrollParent
    /** Container/grid class - defaults to responsive auto-fill grid */
    class?: HTMLAttributes['class']
    /** Overscan row count for virtualizer */
    overscan?: number
  }>(),
  {
    getKey: undefined,
    scrollParent: null,
    class: 'grid grid-cols-[repeat(auto-fill,8rem)] gap-3 justify-between',
    overscan: 2
  }
)

defineSlots<{
  /** Item slot - receives item and index */
  item: (props: { item: T; index: number }) => void
  /** Empty state slot */
  empty?: () => void
}>()

// Refs
const containerRef = ref<HTMLDivElement>()
const rowsRef = ref<HTMLDivElement>()

// State for dynamic measurement
const columnCount = ref(1)
const measuredRowHeight = ref(180)
const measuredRowGap = ref(12)

// Calculate row count based on detected columns
const rowCount = computed(() => Math.ceil(props.items.length / columnCount.value))

// Scroll parent integration (must be before virtualizer to provide getScrollElement and scrollMargin)
const { scrollMargin, resolvedParent, getScrollElement, initialOffset, notifyLayoutChange } =
  useVirtualScrollParent({
    containerRef,
    scrollParent: toRef(props, 'scrollParent'),
    onMeasure: () => virtualizer.value.measure(),
    onResize: measureLayout
  })

// Virtualizer for rows. The initial offset is where the scroll parent is or
// is about to be, so the first render already shows the right rows.
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement,
    initialOffset,
    estimateSize: () => measuredRowHeight.value + measuredRowGap.value,
    overscan: props.overscan,
    scrollMargin: scrollMargin.value
  }))
)

// Get items for a specific row
function getRowItems(rowIndex: number): { item: T; index: number }[] {
  const startIndex = rowIndex * columnCount.value
  const endIndex = Math.min(startIndex + columnCount.value, props.items.length)
  const result: { item: T; index: number }[] = []

  for (let i = startIndex; i < endIndex; i++) {
    result.push({ item: props.items[i]!, index: i })
  }

  return result
}

/**
 * Column count of one live row element. The resolved `grid-template-columns`
 * carries the actual track list even when only one item is rendered, which a
 * child-position scan could never see.
 */
function detectColumnCount(row: HTMLElement): number {
  const style = getComputedStyle(row)

  if (style.display === 'grid' || style.display === 'inline-grid') {
    const tracks = style.gridTemplateColumns.split(' ').filter((token) => token !== '').length
    if (tracks > 0) return tracks
  }

  // Non-grid layout: count children sharing the first child's top edge
  const children = row.children
  if (children.length === 0) return 1
  const firstTop = (children[0] as HTMLElement).offsetTop
  let cols = 0
  for (let i = 0; i < children.length; i++) {
    if ((children[i] as HTMLElement).offsetTop !== firstTop) break
    cols++
  }
  return Math.max(1, cols)
}

/**
 * Measure column count, row height, and row gap from the first rendered row.
 */
async function measureLayout() {
  if (props.items.length === 0) return

  await nextTick()

  const row = rowsRef.value?.firstElementChild as HTMLElement | null
  const firstItem = row?.firstElementChild as HTMLElement | null
  if (!row || !firstItem) return

  columnCount.value = detectColumnCount(row)
  measuredRowHeight.value = firstItem.offsetHeight
  measuredRowGap.value = parseFloat(getComputedStyle(row).rowGap) || 0

  virtualizer.value.measure()
  notifyLayoutChange()
}

onMounted(() => {
  measureLayout()
})

// Re-measure when items change
watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen === oldLen || newLen === 0) return
    measureLayout()
  }
)

// Expose for parent access
defineExpose({
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => {
    const rowIndex = Math.floor(index / columnCount.value)
    virtualizer.value.scrollToIndex(rowIndex, options)
  },
  virtualizer,
  columnCount,
  measuredRowHeight
})
</script>

<template>
  <div
    ref="containerRef"
    :class="cn(!resolvedParent && 'overflow-auto', 'relative')"
  >
    <slot
      v-if="props.items.length === 0"
      name="empty"
    />

    <!-- Virtual list container -->
    <div
      v-else
      ref="rowsRef"
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative'
      }"
    >
      <div
        v-for="virtualRow in virtualizer.getVirtualItems()"
        :key="String(virtualRow.key)"
        :class="props.class"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start - scrollMargin}px)`
        }"
      >
        <template
          v-for="{ item, index } in getRowItems(virtualRow.index)"
          :key="props.getKey?.(item, index) ?? index"
        >
          <slot
            name="item"
            :item="item"
            :index="index"
          />
        </template>
      </div>
    </div>
  </div>
</template>
