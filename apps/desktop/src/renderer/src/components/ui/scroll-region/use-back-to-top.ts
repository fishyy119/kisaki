/**
 * Back-to-top device: the one calibration both of its homes share.
 *
 * The overlay (`BackToTop`) serves the scroll region it is rendered in; a
 * surface that already owns a footer strip (the library explorer) calls this
 * composable with the region's element and renders the button in that strip.
 * Visibility and the jump are decided here so the two homes never drift.
 */

import { ref, watch, type Ref } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'

/** Glyph of the action in both homes. */
export const BACK_TO_TOP_ICON = 'icon-[mdi--arrow-up]'

/**
 * Depth, in viewport heights, past which a region counts as deep. One
 * screen is a wheel flick away; the affordance earns its pixels only once
 * the wheel alternative is a real cost, so short content never shows it.
 */
const DEPTH_THRESHOLD_VIEWPORTS = 2

export interface BackToTopControls {
  /** Whether the region is scrolled deep enough for the affordance to exist. */
  visible: Readonly<Ref<boolean>>
  /**
   * Jump to the top. Instant on purpose: a desktop control jumps rather than
   * glides, and virtualized rows are estimates, so a long smooth scroll
   * through unmeasured rows would judder.
   */
  scrollToTop: () => void
}

export function useBackToTop(
  target: Readonly<Ref<HTMLElement | null | undefined>>
): BackToTopControls {
  const visible = ref(false)

  function update(): void {
    const element = target.value
    visible.value = element
      ? element.scrollTop > element.clientHeight * DEPTH_THRESHOLD_VIEWPORTS
      : false
  }

  useEventListener(target, 'scroll', update, { passive: true })
  // A taller viewport can lift the region back above the threshold.
  useResizeObserver(target, update)
  watch(target, update, { immediate: true })

  function scrollToTop(): void {
    target.value?.scrollTo({ top: 0 })
  }

  return { visible, scrollToTop }
}
