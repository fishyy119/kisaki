<!--
  Table
  Native-table wrapper driven by column definitions: `columns` is the single
  source for the header cells, the colgroup widths, the alignment of heads and
  cells. Every column represents one field without a secondary information line. Call sites write
  body rows only.

  Plain mode renders one table that scrolls with the page. Fixed-header mode
  renders the header and rows as separate tables sharing one colgroup and
  scrollbar gutter so columns stay aligned. The body is a
  ScrollRegion: it fills the available height by default (pass a rem height via
  `bodyClass`, e.g. h-40, for a fixed-size viewport), hosts the back-to-top
  device, and exposes its scroll element for callers that virtualize rows
  against it. The `state` slot renders empty/loading views inside the region.

  Narrow widths preserve the table and its columns. The body scrolls horizontally
  below `minWidth`; the detached header follows its horizontal position.
  The footer is a status strip fixed to the visible width in both modes.
  Density owns body typography and row height; compact rows size to content.
-->
<script setup lang="ts">
import { computed, provide, ref, useTemplateRef, type HTMLAttributes } from 'vue'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { cn } from '@renderer/utils/cn'
import { TableColumnsKey } from './context'
import TableHead from './table-head.vue'
import TableHeader from './table-header.vue'
import TableRow from './table-row.vue'
import type { TableColumn, TableColumnAlign, TableDensity } from './types'
import { TABLE_DENSITIES } from './variants'

const props = defineProps<{
  class?: HTMLAttributes['class']
  /** Column definitions: header, widths, alignment, tone. */
  columns: readonly TableColumn[]
  /** Body typography and row spacing. Defaults to standard. */
  density?: TableDensity
  /** Detach the header from the scrolling rows. */
  fixedHeader?: boolean
  /** Extra classes for the scrolling body region (e.g. a fixed height). */
  bodyClass?: HTMLAttributes['class']
  /** Pad the first and last column to the surface edge (page-wide tables). */
  inset?: boolean
  /** Smallest table width (CSS length); narrower containers scroll horizontally. */
  minWidth?: string
}>()

provide(
  TableColumnsKey,
  computed(() => props.columns)
)

const ALIGN_CLASSES: Record<TableColumnAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right'
}

const hasHeader = computed(() => props.columns.some((column) => column.label))
const density = computed(() => TABLE_DENSITIES[props.density ?? 'standard'])

const tableClass = computed(() =>
  cn('w-full caption-bottom table-fixed', density.value.textClass, props.class)
)

const insetClass = 'data-inset:[&_tr>*:first-child]:pl-4 data-inset:[&_tr>*:last-child]:pr-4'

const tableStyle = computed(() => ({
  minWidth: props.minWidth,
  '--table-row-height':
    density.value.rowHeightRem === null ? 'auto' : `${density.value.rowHeightRem}rem`
}))
const scrollLeft = ref(0)
// Translate the header by the body's offset, including the end of its range.
const bandTableStyle = computed(() => ({
  ...tableStyle.value,
  transform: `translateX(-${scrollLeft.value}px)`
}))

const region = useTemplateRef<InstanceType<typeof ScrollRegion>>('region')

function syncHorizontalScroll() {
  scrollLeft.value = region.value?.element?.scrollLeft ?? 0
}

defineExpose({
  /** The fixed-header body's scroll element; undefined in plain mode or before mount. */
  scrollElement: computed<HTMLElement | undefined>(() => region.value?.element)
})
</script>

<template>
  <div
    data-slot="table-scroller"
    :data-inset="props.inset || undefined"
    :class="cn('flex h-full min-h-0 min-w-0 w-full flex-col', insetClass)"
  >
    <template v-if="fixedHeader">
      <div
        v-if="hasHeader"
        data-slot="table-head-band"
        class="shrink-0 overflow-hidden border-b border-border bg-muted/30 [scrollbar-gutter:stable] [&_tr]:border-0"
      >
        <table
          data-slot="table"
          :class="tableClass"
          :style="bandTableStyle"
        >
          <colgroup>
            <col
              v-for="(column, index) in columns"
              :key="index"
              :style="column.width ? { width: column.width } : undefined"
            />
          </colgroup>
          <TableHeader>
            <TableRow :class="density.headerClass">
              <TableHead
                v-for="(column, index) in columns"
                :key="index"
                :title="column.label"
                :class="column.align && ALIGN_CLASSES[column.align]"
              >
                {{ column.label }}
              </TableHead>
            </TableRow>
          </TableHeader>
        </table>
      </div>

      <ScrollRegion
        ref="region"
        :class="cn('[scrollbar-gutter:stable]', props.bodyClass)"
        @scroll.capture.passive="syncHorizontalScroll"
      >
        <slot name="state" />
        <table
          data-slot="table"
          :class="tableClass"
          :style="tableStyle"
        >
          <colgroup>
            <col
              v-for="(column, index) in columns"
              :key="index"
              :style="column.width ? { width: column.width } : undefined"
            />
          </colgroup>
          <slot />
        </table>
      </ScrollRegion>
    </template>

    <div
      v-else
      data-slot="table-container"
      class="relative min-h-0 w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        :class="tableClass"
        :style="tableStyle"
      >
        <colgroup>
          <col
            v-for="(column, index) in columns"
            :key="index"
            :style="column.width ? { width: column.width } : undefined"
          />
        </colgroup>
        <TableHeader
          v-if="hasHeader"
          class="bg-muted/30"
        >
          <TableRow :class="density.headerClass">
            <TableHead
              v-for="(column, index) in columns"
              :key="index"
              :title="column.label"
              :class="column.align && ALIGN_CLASSES[column.align]"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <slot />
      </table>
    </div>
    <div
      v-if="$slots.footer"
      data-slot="table-footer"
      :class="
        cn(
          'shrink-0 border-t border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground',
          props.inset && 'px-4'
        )
      "
    >
      <slot name="footer" />
    </div>
  </div>
</template>
