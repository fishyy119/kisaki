import { computed, onMounted, onUnmounted, ref, unref, watch, type Ref } from 'vue'
import { useOptionalScrollRegion } from '@renderer/components/ui/scroll-region'
import { onLayoutInvalidate, invalidateLayout } from './virtual-layout-invalidation'

/**
 * External scroll parent of a virtual component: `'region'` for the enclosing
 * ScrollRegion (resolved through the component tree, so it is known at setup,
 * before anything is in the DOM), a concrete element, or null/undefined for
 * self-contained scrolling.
 */
export type VirtualScrollParent = HTMLElement | 'region' | null | undefined

export interface UseVirtualScrollParentOptions {
  /** Reference to the container element */
  containerRef: Ref<HTMLElement | undefined>
  /** External scroll parent, or 'region' for the enclosing ScrollRegion */
  scrollParent: Ref<VirtualScrollParent>
  /** Callback to trigger virtualizer measure (called lazily to avoid circular deps) */
  onMeasure?: () => void
  /** Whether this is horizontal scrolling (affects margin and detection axis) */
  horizontal?: boolean
  /** Callback when resize is detected */
  onResize?: () => void
}

/**
 * Composable for managing scroll parent integration in virtual components.
 * Handles scroll parent resolution, scroll margin calculation, resize
 * observation, layout invalidation, and the initial offset the virtualizer
 * renders for before it attaches.
 */
export function useVirtualScrollParent(options: UseVirtualScrollParentOptions) {
  const { containerRef, scrollParent, onMeasure, horizontal = false, onResize } = options

  const region = useOptionalScrollRegion()
  if (unref(scrollParent) === 'region' && !region) {
    throw new Error('scroll-parent="region" requires an enclosing ScrollRegion')
  }

  /** The effective external scroll parent; null means self-contained scrolling. */
  const resolvedParent = computed<HTMLElement | null>(() => {
    const wanted = unref(scrollParent)
    if (!wanted) return null
    if (wanted === 'region') return region?.element.value ?? null
    return wanted
  })

  // Get the effective scroll element
  const getScrollElement = () => resolvedParent.value ?? containerRef.value ?? null

  /**
   * Offset the parent is at, or is about to be at. A region answers with its
   * remembered offset before its element exists, so the first render already
   * shows the rows at that offset and the virtualizer's attach-time scroll to
   * this value is a no-op: a virtual component never moves a scroll element
   * it did not create.
   */
  function initialOffset(): number {
    const wanted = unref(scrollParent)
    if (!wanted) return 0
    if (wanted === 'region') return horizontal ? 0 : (region?.offset() ?? 0)
    return horizontal ? wanted.scrollLeft : wanted.scrollTop
  }

  const scrollMargin = ref(0)

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
    initialOffset,
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
