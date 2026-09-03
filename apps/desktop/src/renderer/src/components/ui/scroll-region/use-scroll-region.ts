/**
 * Scroll region handle.
 *
 * What a region provides to the components inside it: the scrolling element,
 * the identity it displays, and the offset it is at or about to be at. The
 * handle travels down the component tree, so a virtual list resolves its
 * scroll parent at setup, before anything is in the DOM, and a nested
 * horizontal row derives its own memory identity from the region's.
 */

import { inject, type InjectionKey, type Ref } from 'vue'

export interface ScrollRegionHandle {
  /** The scrolling element; undefined until the region has mounted. */
  element: Readonly<Ref<HTMLElement | undefined>>
  /** Memory identity of the displayed content; undefined for a region without memory. */
  identity: Readonly<Ref<string | undefined>>
  /**
   * The vertical offset the region is at, or is entering at. A declarative
   * target rather than an observation: readable before the element exists and
   * during an identity switch, where it already names the next identity's
   * remembered offset. Kept live by the region's own scroll events.
   */
  offset: () => number
}

export const ScrollRegionKey: InjectionKey<ScrollRegionHandle> = Symbol('scrollRegion')

/** The enclosing region's handle; throws outside a region so a missing host is a build error, not a silent no-op. */
export function useScrollRegion(): ScrollRegionHandle {
  const handle = inject(ScrollRegionKey, null)
  if (!handle) {
    throw new Error('useScrollRegion() must be used inside a ScrollRegion')
  }
  return handle
}

/** The enclosing region's handle, or null when there is none. */
export function useOptionalScrollRegion(): ScrollRegionHandle | null {
  return inject(ScrollRegionKey, null)
}
