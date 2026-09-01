<!--
  VirtualList - Virtualized vertical list component

  Features:
  - Vertical virtual scrolling for fixed-height items
  - Supports parent container scrolling ('auto' resolves the closest ancestor)
  - Dynamic item height measurement from the first rendered item

  @example
  ```vue
  <VirtualList :items="entities" scroll-parent="auto">
    <template #item="{ item, index }">
      <ListItem :entity="item" />
    </template>
  </VirtualList>
  ```
-->
<script setup lang="ts" generic="T">
import { ref, computed, onMounted, watch, nextTick, toRef, type HTMLAttributes } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { cn } from '@renderer/utils/cn'
import { useVirtualScrollParent, type VirtualScrollParent } from './use-virtual-scroll-parent'

const props = withDefaults(
  defineProps<{
    /** Items to render */
    items: T[]
    /** Custom key extractor, defaults to index */
    getKey?: (item: T, index: number) => string | number
    /** External scroll parent: element, 'auto' for closest scrollable ancestor */
    scrollParent?: VirtualScrollParent
    /** Container class - defaults to flex column with small gap */
    class?: HTMLAttributes['class']
    /** Overscan count for virtualizer */
    overscan?: number
  }>(),
  {
    getKey: undefined,
    scrollParent: null,
    class: 'flex flex-col gap-0.5',
    overscan: 5
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

// State
const measuredItemHeight = ref(24)
const measuredGap = ref(2)

// Scroll parent integration (must be before virtualizer to provide getScrollElement and scrollMargin)
const { scrollMargin, resolvedParent, getScrollElement, notifyLayoutChange } =
  useVirtualScrollParent({
    containerRef,
    scrollParent: toRef(props, 'scrollParent'),
    onMeasure: () => virtualizer.value.measure(),
    onResize: measureLayout
  })

// Virtualizer
const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    getScrollElement,
    estimateSize: () => measuredItemHeight.value + measuredGap.value,
    overscan: props.overscan,
    scrollMargin: scrollMargin.value
  }))
)

/**
 * Measure item height from the first rendered item and the gap from the rows
 * container, which carries the caller's layout class (children are absolutely
 * positioned, so the class only contributes its gap value).
 */
async function measureLayout() {
  if (props.items.length === 0) return

  await nextTick()

  const rows = rowsRef.value
  // Measure the slot content, not the positioning wrapper around it
  const firstItem = rows?.firstElementChild?.firstElementChild as HTMLElement | null
  if (!rows || !firstItem) return

  measuredItemHeight.value = firstItem.offsetHeight

  const computedStyle = getComputedStyle(rows)
  measuredGap.value = parseFloat(computedStyle.rowGap) || parseFloat(computedStyle.gap) || 0

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

// Expose methods
defineExpose({
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => {
    virtualizer.value.scrollToIndex(index, options)
  },
  virtualizer,
  measuredItemHeight,
  measuredGap
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

    <!-- Virtual list container; the class supplies the gap being measured -->
    <div
      v-else
      ref="rowsRef"
      :class="props.class"
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
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
          width: '100%',
          transform: `translateY(${virtualItem.start - scrollMargin}px)`
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
