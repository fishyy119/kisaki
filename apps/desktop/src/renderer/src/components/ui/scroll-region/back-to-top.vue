<!--
  BackToTop - Overlay home of the back-to-top device.

  A transient scroll aid for deep, unbounded content regions (browse grids,
  detail bodies): absent until the region is scrolled past two screens, then
  one button, styled as an opaque slab, in the bottom-right corner of the
  viewport that jumps back to the top. No entrance animation and no hover
  state - it appears and disappears the way the explorer's locate affordance
  does, and reads as a static fixture while it exists.

  Rendered only by `ScrollRegion`, as the sibling of its scroll element; it
  finds the element through the region's handle like any other descendant.
  Surfaces that already own a footer strip render the device there through
  `useBackToTop` instead of this overlay.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import { BACK_TO_TOP_ICON, useBackToTop } from './use-back-to-top'
import { useScrollRegion } from './use-scroll-region'

const region = useScrollRegion()
if (!region) {
  throw new Error('BackToTop must be rendered inside a ScrollRegion')
}

const { m } = useI18n()

const { visible, scrollToTop } = useBackToTop(region.element)
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-slot="back-to-top"
    class="absolute right-4 bottom-4 z-10 flex size-7 items-center justify-center rounded-md border border-border bg-popover text-muted-foreground shadow-overlay outline-none focus-visible:ring-1 focus-visible:ring-primary"
    :aria-label="m.actions.backToTop"
    @click="scrollToTop"
  >
    <Icon
      :icon="BACK_TO_TOP_ICON"
      class="size-4"
    />
  </button>
</template>
