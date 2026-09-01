import { ref, unref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { onLayoutInvalidate, invalidateLayout } from './virtual-layout-invalidation'

/**
 * External scroll parent of a virtual component: a concrete element, `'auto'`
 * to resolve the closest scrollable ancestor on mount, or null/undefined for
 * self-contained scrolling.
 */
export type VirtualScrollParent = HTMLElement | 'auto' | null | undefined

export interface UseVirtualScrollParentOptions {
  /** Reference to the container element */
  containerRef: Ref<HTMLElement | undefined>
  /** External scroll parent element, or 'auto' for ancestor detection */
  scrollParent: Ref<VirtualScrollParent>
  /** Callback to trigger virtualizer measure (called lazily to avoid circular deps) */
  onMeasure?: () => void
  /** Whether this is horizontal scrolling (affects margin and detection axis) */
  horizontal?: boolean
  /** Callback when resize is detected */
  onResize?: () => void
}

/** Closest ancestor that scrolls on the wanted axis, or null when none does. */
function findScrollableAncestor(start: HTMLElement, horizontal: boolean): HTMLElement | null {
  let node = start.parentElement
  while (node) {
    const style = getComputedStyle(node)
    const overflow = horizontal ? style.overflowX : style.overflowY
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * Composable for managing scroll parent integration in virtual components.
 * Handles scroll margin calculation, resize observation, and layout invalidation.
 */
export function useVirtualScrollParent(options: UseVirtualScrollParentOptions) {
  const { containerRef, scrollParent, onMeasure, horizontal = false, onResize } = options

  const scrollMargin = ref(0)

  /** The effective external scroll parent; null means self-contained scrolling. */
  const resolvedParent = ref<HTMLElement | null>(null)

  function resolveParent(): HTMLElement | null {
    const wanted = unref(scrollParent)
    if (!wanted) return null
    if (wanted !== 'auto') return wanted
    return containerRef.value ? findScrollableAncestor(containerRef.value, horizontal) : null
  }

  // Get the effective scroll element
  const getScrollElement = () => resolvedParent.value ?? containerRef.value ?? null

  // Calculate scroll margin based on container position relative to scroll parent
  function computeScrollMargin(): number {
    const parent = resolvedParent.value
    if (!parent || !containerRef.value) return 0

    const containerRect = containerRef.value.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()

    if (horizontal) {
      return containerRect.left - parentRect.left + parent.scrollLeft
    }
    return containerRect.top - parentRect.top + parent.scrollTop
  }

  // Update scroll margin and trigger virtualizer measure
  function updateScrollMargin() {
    if (!resolvedParent.value) {
      scrollMargin.value = 0
      return
    }
    const nextMargin = computeScrollMargin()
    if (nextMargin === scrollMargin.value) return
    scrollMargin.value = nextMargin
    onMeasure?.()
  }

  // Throttled scroll margin update using requestAnimationFrame
  let updateScheduled = false
  function scheduleScrollMarginUpdate() {
    if (updateScheduled) return
    updateScheduled = true
    requestAnimationFrame(() => {
      updateScheduled = false
      updateScrollMargin()
    })
  }

  // Internal state
  let resizeObserver: ResizeObserver | null = null
  let unsubscribeLayout: (() => void) | null = null

  onMounted(() => {
    resolvedParent.value = resolveParent()
    scheduleScrollMarginUpdate()

    // Setup resize observer
    resizeObserver = new ResizeObserver(() => {
      scheduleScrollMarginUpdate()
      onResize?.()
    })

    if (containerRef.value) resizeObserver.observe(containerRef.value)
    const parent = resolvedParent.value
    if (parent) resizeObserver.observe(parent)

    // Subscribe to layout invalidation
    if (parent) {
      unsubscribeLayout = onLayoutInvalidate(parent, scheduleScrollMarginUpdate)
      invalidateLayout(parent)
    }
  })

  onUnmounted(() => {
    const parent = resolvedParent.value
    if (parent) invalidateLayout(parent)
    resizeObserver?.disconnect()
    unsubscribeLayout?.()
  })

  // Re-resolve when the declared scroll parent changes
  watch(
    () => unref(scrollParent),
    () => {
      resolvedParent.value = resolveParent()
    }
  )

  // Rewire observation and layout subscription to the resolved element
  watch(resolvedParent, (nextParent, prevParent) => {
    if (nextParent === prevParent) return

    // Update resize observer
    if (resizeObserver) {
      if (prevParent) resizeObserver.unobserve(prevParent)
      if (nextParent) resizeObserver.observe(nextParent)
    }

    // Update layout subscription
    unsubscribeLayout?.()
    unsubscribeLayout = null
    scrollMargin.value = 0

    if (!nextParent) return
    unsubscribeLayout = onLayoutInvalidate(nextParent, scheduleScrollMarginUpdate)
    scheduleScrollMarginUpdate()
    invalidateLayout(nextParent)
  })

  return {
    scrollMargin,
    resolvedParent,
    getScrollElement,
    scheduleScrollMarginUpdate,
    /**
     * Synchronous margin refresh for callers that need correct scroll math
     * right now (programmatic scrolls); the rAF-throttled path only serves
     * scroll/resize churn.
     */
    updateScrollMargin,
    /** Notify sibling components that layout has changed */
    notifyLayoutChange: () => {
      const parent = resolvedParent.value
      if (parent) invalidateLayout(parent)
    }
  }
}
