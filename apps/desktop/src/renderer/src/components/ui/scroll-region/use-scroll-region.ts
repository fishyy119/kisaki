/**
 * Scroll region handle.
 *
 * What a region provides to the components inside it: the scrolling element,
 * the offset it is at, and a layout bus. The handle travels down the
 * component tree, so a virtual list resolves its scroll parent at setup,
 * before anything is in the DOM, and sibling virtual lists in one region
 * tell each other when their height changed.
 */

import { inject, type InjectionKey, type Ref } from 'vue'

export interface ScrollRegionLayout {
  /** Run the callback whenever a component in the region reports a layout change. */
  subscribe: (callback: () => void) => () => void
  /** Report that this component's layout changed. */
  invalidate: () => void
}

export interface ScrollRegionHandle {
  /** The scrolling element; undefined until the region has mounted. */
  element: Readonly<Ref<HTMLElement | undefined>>
  /**
   * The vertical offset the region is at. A component mounting late reads
   * the live position; a component mounting with the region reads 0, where
   * a fresh scroll element is.
   */
  offset: () => number
  layout: ScrollRegionLayout
}

export const ScrollRegionKey: InjectionKey<ScrollRegionHandle> = Symbol('scrollRegion')

/** The enclosing region's handle, or null when there is none. */
export function useScrollRegion(): ScrollRegionHandle | null {
  return inject(ScrollRegionKey, null)
}
