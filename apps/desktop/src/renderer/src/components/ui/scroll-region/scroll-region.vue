<!--
  ScrollRegion - The application's scroll viewport.

  Every scrolling surface is one of these: a route page body, a browse grid, a
  dialog body, a persistent panel. The region owns three things that used to
  be repeated wherever a surface scrolled: the layout that frames the
  viewport, the back-to-top device, and the memory of where the viewport was.

  Memory. A region with a `memory` identity remembers its offset under that
  identity and restores it whenever it displays the identity again. The
  identity names what the content is (a route path, a route path with its
  list query, a fixed panel name); an identity change remounts the scroll
  element (keyed by identity), so entering an identity is always a mount, the
  content inside renders fresh, and the remembered offset is applied once the
  new content is in the DOM. A region without `memory` only hosts.

  Handle. The region provides `{ element, identity, offset }` to its subtree.
  `offset()` is the offset the region is at or about to be at; virtual lists
  read it as their initial offset before the element exists, which is what
  lets them render the right rows on the first frame and makes their
  attach-time scroll a no-op instead of a jump to the top.

  Layout. The host is a flex column that exactly frames the viewport: it
  fills a flex-column parent as a flex item and a block parent through its
  full height, and an auto-height parent (a max-h dialog) lets it size to its
  content. The scroll element is its flex item and paints the plane (`class`
  lands on it, so background and padding are the caller's). The device is the
  sibling of the scroll element, absolutely placed in the host's corner; a
  surface that renders the device in its own footer strip passes
  `:back-to-top="false"`.

    <div class="h-full flex flex-col">
      <PageHeader />
      <ScrollRegion :memory="route.path" class="bg-background p-4">…</ScrollRegion>
    </div>
-->
<script setup lang="ts">
import { computed, onMounted, provide, ref, watch, type HTMLAttributes } from 'vue'
import { useEventListener } from '@vueuse/core'
import { BackToTop } from '@renderer/components/ui/back-to-top'
import { cn } from '@renderer/utils/cn'
import { readScrollMemory, writeScrollMemory } from './scroll-memory'
import { ScrollRegionKey, type ScrollRegionHandle } from './use-scroll-region'

const props = withDefaults(
  defineProps<{
    /** Memory identity of the displayed content; omit for a region that only hosts. */
    memory?: string
    /** Classes of the scroll element: background, padding, gutter policy. */
    class?: HTMLAttributes['class']
    /** Whether the region renders the back-to-top device in its corner. */
    backToTop?: boolean
  }>(),
  {
    memory: undefined,
    class: undefined,
    backToTop: true
  }
)

const element = ref<HTMLElement>()
const identity = computed(() => props.memory)

function offset(): number {
  if (props.memory !== undefined) return readScrollMemory(props.memory) ?? 0
  return element.value?.scrollTop ?? 0
}

/** Applies the identity's remembered offset to the freshly mounted scroll element. */
function restore(): void {
  const target = element.value
  if (!target || props.memory === undefined) return
  target.scrollTop = readScrollMemory(props.memory) ?? 0
}

// Children mount before the parent's mounted hook runs, so the content is in
// the DOM at both restore points; because route data is committed before the
// page renders, that content is complete and one restore is exact.
onMounted(restore)
watch(identity, restore, { flush: 'post' })

useEventListener(
  element,
  'scroll',
  () => {
    if (props.memory === undefined || !element.value) return
    writeScrollMemory(props.memory, element.value.scrollTop)
  },
  { passive: true }
)

const handle: ScrollRegionHandle = { element, identity, offset }
provide(ScrollRegionKey, handle)

defineExpose({ element })
</script>

<template>
  <div
    data-slot="scroll-region"
    class="relative flex h-full min-h-0 flex-1 flex-col"
  >
    <div
      ref="element"
      :key="identity"
      data-slot="scroll-region-viewport"
      :class="cn('min-h-0 flex-1 overflow-auto', props.class)"
    >
      <slot />
    </div>

    <BackToTop
      v-if="props.backToTop"
      :target="element"
    />
  </div>
</template>
