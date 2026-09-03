<!--
  Resizable Layout - provides context for panels and handle.

  Widths are rem: pane bounds encode content (how many characters of an entity
  name fit) and the stored pane width follows the interface scale like every
  other content size. The left pane moves between its own bounds, and the
  right pane is never squeezed below its minimum: the effective ceiling of the
  left width is the container width minus the handle and the right minimum.
  The model value is the user's chosen width; it is clamped on every read
  (drag, container resize, hydration of a width from a wider window) and
  written back only when the container itself makes it invalid. Pixel values
  exist only at the DOM edge (pointer deltas, the observed container width).

  Both minimums always fit: the viewport contract's narrowest main area holds
  the left minimum, the handle, and the right minimum, so the layout has no
  collapsed mode. If the contract or the minimums change, re-derive that before
  adding one.
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type HTMLAttributes } from 'vue'
import { remToPx, rootFontSizePx } from '@renderer/core/interface-scale'
import { cn } from '@renderer/utils/cn'
import { useProvideResizable } from './use-resizable'

interface Props {
  /** Left pane width in rem (the user's choice). */
  leftWidth: number
  defaultWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  /** Width in rem the right pane keeps at least; the left pane yields to it. */
  minRightWidth?: number
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 16,
  minLeftWidth: 14,
  maxLeftWidth: 30,
  minRightWidth: 30
})

const emit = defineEmits<{
  'update:leftWidth': [width: number]
}>()

const containerRef = ref<HTMLDivElement>()
const containerWidthPx = ref(0)
const isResizing = ref(false)

const HANDLE_SIZE_REM = 0.25
let startX = 0
let startWidth = 0

const containerWidth = computed(() => containerWidthPx.value / rootFontSizePx.value)

/** Largest left width that still leaves the right pane its minimum. */
const effectiveMaxLeftWidth = computed(() => {
  if (containerWidthPx.value === 0) return props.maxLeftWidth
  const roomForLeft = containerWidth.value - HANDLE_SIZE_REM - props.minRightWidth
  return Math.max(props.minLeftWidth, Math.min(props.maxLeftWidth, roomForLeft))
})

function clampLeftWidth(width: number): number {
  return Math.max(props.minLeftWidth, Math.min(effectiveMaxLeftWidth.value, width))
}

const clampedLeftWidth = computed(() => clampLeftWidth(props.leftWidth))

const rightWidth = computed(() =>
  Math.max(0, containerWidth.value - clampedLeftWidth.value - HANDLE_SIZE_REM)
)

// A stored width the container can no longer honor is written back, so the
// persisted preference tracks what is actually shown.
watch([clampedLeftWidth, () => props.leftWidth], ([clamped, requested]) => {
  if (containerWidthPx.value > 0 && clamped !== requested) emit('update:leftWidth', clamped)
})

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startX = e.clientX
  startWidth = clampedLeftWidth.value
}

function resetToDefault() {
  emit('update:leftWidth', clampLeftWidth(props.defaultWidth))
}

function handleMouseMove(e: MouseEvent) {
  if (!isResizing.value) return

  const deltaRem = (e.clientX - startX) / rootFontSizePx.value
  emit('update:leftWidth', clampLeftWidth(startWidth + deltaRem))
}

function handleMouseUp() {
  if (isResizing.value) {
    isResizing.value = false
  }
}

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value) return

  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidthPx.value = entry.contentRect.width
    }
  })
  observer.observe(containerRef.value)

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  observer?.disconnect()
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

useProvideResizable({
  get leftWidthPx() {
    return remToPx(clampedLeftWidth.value)
  },
  get rightWidthPx() {
    return remToPx(rightWidth.value)
  },
  get handleSizePx() {
    return remToPx(HANDLE_SIZE_REM)
  },
  get isResizing() {
    return isResizing.value
  },
  startResize,
  resetToDefault
})
</script>

<template>
  <div
    ref="containerRef"
    :class="cn('flex h-full relative', props.class)"
    data-slot="resizable-layout"
  >
    <slot />
  </div>
</template>
