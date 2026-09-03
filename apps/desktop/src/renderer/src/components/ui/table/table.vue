<!--
  Table
  Native-table wrapper. Plain mode renders one table that scrolls with the
  page. Fixed-header mode owns the "header outside the scroll area" rule:
  the header/footer slots and the rows render as separate tables sharing one
  colgroup (`columns`, required for cross-table alignment), and every region
  reserves the scrollbar gutter so columns stay aligned with the scrolling
  body. Band chrome (fill + border) lives on the region wrappers - not on
  thead/tfoot - so it also covers the reserved gutter strip. The body is a
  ScrollRegion: it fills the available height by default (pass a height via
  `bodyClass`, e.g. h-[20vh], for a fixed-size viewport), hosts the
  back-to-top device, and exposes its scroll element for callers that
  virtualize rows against it. The `state` slot renders empty/loading views
  inside the scroll region.
-->
<script setup lang="ts">
import { computed, useTemplateRef, type HTMLAttributes } from 'vue'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
  /** Detach header/footer from the scrolling rows (requires `columns`). */
  fixedHeader?: boolean
  /** CSS column widths ('' = flexible), rendered as a shared colgroup. */
  columns?: readonly string[]
  /** Extra classes for the scrolling body region (e.g. a fixed height). */
  bodyClass?: HTMLAttributes['class']
}>()

const region = useTemplateRef<InstanceType<typeof ScrollRegion>>('region')

defineExpose({
  /** The fixed-header body's scroll element; undefined in plain mode or before mount. */
  scrollElement: computed<HTMLElement | undefined>(() => region.value?.element)
})
</script>

<template>
  <div
    v-if="fixedHeader"
    data-slot="table-container"
    class="flex h-full min-h-0 w-full flex-col"
  >
    <div
      v-if="$slots.header"
      class="shrink-0 overflow-hidden border-b border-border bg-muted/30 [scrollbar-gutter:stable] [&_tr]:border-0"
    >
      <table
        data-slot="table"
        :class="cn('w-full table-fixed caption-bottom text-xs', props.class)"
      >
        <colgroup>
          <col
            v-for="(width, index) in columns"
            :key="index"
            :style="width ? { width } : undefined"
          />
        </colgroup>
        <slot name="header" />
      </table>
    </div>

    <ScrollRegion
      ref="region"
      :class="cn('[scrollbar-gutter:stable]', props.bodyClass)"
    >
      <slot name="state" />
      <table
        data-slot="table"
        :class="cn('w-full table-fixed caption-bottom text-xs', props.class)"
      >
        <colgroup>
          <col
            v-for="(width, index) in columns"
            :key="index"
            :style="width ? { width } : undefined"
          />
        </colgroup>
        <slot />
      </table>
    </ScrollRegion>

    <div
      v-if="$slots.footer"
      class="shrink-0 overflow-hidden border-t border-border bg-muted/30 [scrollbar-gutter:stable] [&_tr]:border-0"
    >
      <table
        data-slot="table"
        :class="cn('w-full table-fixed caption-bottom text-xs', props.class)"
      >
        <colgroup>
          <col
            v-for="(width, index) in columns"
            :key="index"
            :style="width ? { width } : undefined"
          />
        </colgroup>
        <slot name="footer" />
      </table>
    </div>
  </div>

  <div
    v-else
    data-slot="table-container"
    class="relative w-full overflow-auto"
  >
    <table
      data-slot="table"
      :class="cn('w-full caption-bottom text-xs', props.class)"
    >
      <slot name="header" />
      <slot />
      <slot name="footer" />
    </table>
  </div>
</template>
