<!--
  ScrollRegion - The application's scroll viewport.

  Every surface that scrolls is one of these: a route page body, a browse
  grid, a dialog body, a side panel. The region owns what used to be repeated
  wherever a surface scrolled: the layout that frames the viewport, the
  back-to-top device, and the handle through which virtual lists inside it
  find their scroll parent.

  Layout. The host is a flex column that exactly frames the viewport: it
  fills a flex-column parent as a flex item and a block parent through its
  full height, and an auto-height parent (a max-h dialog) lets it size to its
  content. The scroll element is its flex item and paints the plane (`class`
  lands on it, so background, padding, and an explicit height are the
  caller's; both items grow from their own size rather than from zero, so a
  height passed through `class` holds inside an auto-height host). The device
  is the sibling of the scroll element, absolutely placed in the host's
  corner, and reads the element through the handle like any other descendant;
  a surface that renders the device in its own footer strip passes
  `:back-to-top="false"` and wires `useBackToTop` to the exposed element.

  Responsive baseline. The scroll element is a query container, so content
  written directly into a page or dialog body lays out against the width it
  actually gets with unnamed `@<step>:` variants, never against the window.
  Reusable components that reflow bring their own container root instead of
  relying on this one, so they stay correct inside narrower columns.

    <div class="h-full flex flex-col">
      <PageHeader />
      <ScrollRegion class="bg-background p-4">…</ScrollRegion>
    </div>
-->
<script setup lang="ts">
import { provide, ref, type HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'
import BackToTop from './back-to-top.vue'
import { ScrollRegionKey, type ScrollRegionHandle } from './use-scroll-region'

const props = withDefaults(
  defineProps<{
    /** Classes of the scroll element: background, padding, gutter policy. */
    class?: HTMLAttributes['class']
    /** Whether the region renders the back-to-top device in its corner. */
    backToTop?: boolean
  }>(),
  {
    class: undefined,
    backToTop: true
  }
)

const element = ref<HTMLElement>()

const layoutListeners = new Set<() => void>()

const handle: ScrollRegionHandle = {
  element,
  offset: () => element.value?.scrollTop ?? 0,
  layout: {
    subscribe(callback) {
      layoutListeners.add(callback)
      return () => {
        layoutListeners.delete(callback)
      }
    },
    invalidate() {
      for (const listener of [...layoutListeners]) listener()
    }
  }
}
provide(ScrollRegionKey, handle)

defineExpose({ element })
</script>

<template>
  <div
    data-slot="scroll-region"
    class="relative flex h-full min-h-0 grow flex-col"
  >
    <div
      ref="element"
      data-slot="scroll-region-viewport"
      :class="cn('@container min-h-0 grow overflow-auto', props.class)"
    >
      <slot />
    </div>

    <BackToTop v-if="props.backToTop" />
  </div>
</template>
