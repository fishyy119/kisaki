import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import { useScrollRegion } from '@renderer/components/ui/scroll-region'

/**
 * Where a virtual component scrolls: on its own container (`'self'`) or
 * inside the enclosing ScrollRegion (`'region'`, resolved through the
 * component tree so it is known at setup, before anything is in the DOM).
 */
export type VirtualScroll = 'self' | 'region'

export interface UseVirtualScrollParentOptions {
  /** Reference to the container element */
  containerRef: Ref<HTMLElement | undefined>
  /** Read once at setup: the scroll parent is a fact of the component tree, fixed for the instance. */
  scroll: MaybeRefOrGetter<VirtualScroll>
  /** Callback to trigger virtualizer measure (called lazily to avoid circular deps) */
  onMeasure?: () => void
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
  const { containerRef, onMeasure, onResize } = options

  const scroll = toValue(options.scroll)
  const region = scroll === 'region' ? useScrollRegion() : null
  if (scroll === 'region' && !region) {
    throw new Error('scroll="region" requires an enclosing ScrollRegion')
  }

  /** The region's scroll element; null while self-contained or before the region mounts. */
  const resolvedParent = computed<HTMLElement | null>(() => region?.element.value ?? null)

  const getScrollElement = () => resolvedParent.value ?? containerRef.value ?? null

  /**
   * Offset the scroll element is at when this component first renders. A
   * component mounting late into a scrolled region reads the live offset, so
   * its first render shows the right rows and the virtualizer's attach-time
   * scroll to this value is a no-op: a virtual component never moves a scroll
   * element it did not create.
   */
  function initialOffset(): number {
    return region?.offset() ?? 0
  }

  const scrollMargin = ref(0)

  // Calculate scroll margin based on container position relative to scroll parent
  function computeScrollMargin(): number {
    const parent = resolvedParent.value
    if (!parent || !containerRef.value) return 0

    const containerRect = containerRef.value.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
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

  let resizeObserver: ResizeObserver | null = null
  let unsubscribeLayout: (() => void) | null = null

  onMounted(() => {
    // Synchronous, so the first painted frame already positions rows below
    // whatever precedes the container in the region; churn goes through rAF.
    updateScrollMargin()

    resizeObserver = new ResizeObserver(() => {
      scheduleScrollMarginUpdate()
      onResize?.()
    })

    if (containerRef.value) resizeObserver.observe(containerRef.value)
    const parent = resolvedParent.value
    if (parent) resizeObserver.observe(parent)

    if (region) {
      unsubscribeLayout = region.layout.subscribe(scheduleScrollMarginUpdate)
      region.layout.invalidate()
    }
  })

  onUnmounted(() => {
    region?.layout.invalidate()
    resizeObserver?.disconnect()
    unsubscribeLayout?.()
  })

  return {
    scrollMargin,
    resolvedParent,
    getScrollElement,
    initialOffset,
    /**
     * Synchronous margin refresh for callers that need correct scroll math
     * right now (programmatic scrolls); the rAF-throttled path only serves
     * scroll/resize churn.
     */
    updateScrollMargin,
    /** Notify sibling components in the region that layout has changed */
    notifyLayoutChange: () => region?.layout.invalidate()
  }
}
