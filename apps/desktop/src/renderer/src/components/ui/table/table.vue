<!--
  Table
  Native-table wrapper driven by column definitions: `columns` is the single
  source for the header cells, the colgroup widths, the alignment of heads and
  cells, and the labels cells carry once the table reflows. Call sites write
  body rows only.

  Plain mode renders one table that scrolls with the page. Fixed-header mode
  owns the "header outside the scroll area" rule: the header, the rows, and
  the footer slot render as separate tables sharing one colgroup, and every
  region reserves the scrollbar gutter so columns stay aligned. The body is a
  ScrollRegion: it fills the available height by default (pass a rem height via
  `bodyClass`, e.g. h-40, for a fixed-size viewport), hosts the back-to-top
  device, and exposes its scroll element for callers that virtualize rows
  against it. The `state` slot renders empty/loading views inside the region.

  Narrow widths. Columns are never hidden: a table whose row still reads as a
  list declares `reflowBelow` and, once its own container is narrower than
  that step, the same rows reflow into stacked cards (primary cell as the
  headline, meta cells as labelled lines, actions to the right). A table whose
  rows must stay uniform (virtualized lists, dense numeric grids) declares
  `minWidth` and scrolls horizontally instead. Use one or the other.
-->
<script setup lang="ts">
import { computed, provide, useTemplateRef, type HTMLAttributes } from 'vue'
import type { ContainerStep } from '@renderer/components/ui/container'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { cn } from '@renderer/utils/cn'
import { TableColumnsKey } from './context'
import TableHead from './table-head.vue'
import TableHeader from './table-header.vue'
import TableRow from './table-row.vue'
import type { TableColumn, TableColumnAlign } from './types'

const props = defineProps<{
  class?: HTMLAttributes['class']
  /** Column definitions: header, widths, alignment, reflow roles. */
  columns: readonly TableColumn[]
  /** Detach header/footer from the scrolling rows. */
  fixedHeader?: boolean
  /** Extra classes for the scrolling body region (e.g. a fixed height). */
  bodyClass?: HTMLAttributes['class']
  /** Pad the first and last column to the surface edge (page-wide tables). */
  inset?: boolean
  /** Container step below which rows reflow into stacked cards. */
  reflowBelow?: ContainerStep
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

const tableClass = computed(() =>
  cn('w-full caption-bottom text-xs', props.fixedHeader && 'table-fixed', props.class)
)

const insetClass = 'data-inset:[&_tr>*:first-child]:pl-4 data-inset:[&_tr>*:last-child]:pr-4'

const region = useTemplateRef<InstanceType<typeof ScrollRegion>>('region')

defineExpose({
  /** The fixed-header body's scroll element; undefined in plain mode or before mount. */
  scrollElement: computed<HTMLElement | undefined>(() => region.value?.element)
})
</script>

<template>
  <!-- The scroller is the query container the reflow step is measured against:
       the width the table actually gets, wherever it is placed -->
  <div
    data-slot="table-scroller"
    :class="cn('@container h-full min-h-0 w-full', props.minWidth && 'overflow-x-auto')"
  >
    <div
      v-if="fixedHeader"
      data-slot="table-container"
      :data-inset="props.inset || undefined"
      :data-reflow="props.reflowBelow"
      :class="cn('flex h-full min-h-0 w-full flex-col', insetClass)"
      :style="props.minWidth ? { minWidth: props.minWidth } : undefined"
    >
      <div
        v-if="hasHeader"
        data-slot="table-head-band"
        class="shrink-0 overflow-hidden border-b border-border bg-muted/30 [scrollbar-gutter:stable] [&_tr]:border-0"
      >
        <table
          data-slot="table"
          :class="tableClass"
        >
          <colgroup>
            <col
              v-for="(column, index) in columns"
              :key="index"
              :style="column.width ? { width: column.width } : undefined"
            />
          </colgroup>
          <TableHeader>
            <TableRow class="h-8">
              <TableHead
                v-for="(column, index) in columns"
                :key="index"
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
      >
        <slot name="state" />
        <table
          data-slot="table"
          :class="tableClass"
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

      <div
        v-if="$slots.footer"
        data-slot="table-foot-band"
        class="shrink-0 overflow-hidden border-t border-border bg-muted/30 [scrollbar-gutter:stable] [&_tr]:border-0"
      >
        <table
          data-slot="table"
          :class="tableClass"
        >
          <colgroup>
            <col
              v-for="(column, index) in columns"
              :key="index"
              :style="column.width ? { width: column.width } : undefined"
            />
          </colgroup>
          <slot name="footer" />
        </table>
      </div>
    </div>

    <div
      v-else
      data-slot="table-container"
      :data-inset="props.inset || undefined"
      :data-reflow="props.reflowBelow"
      :class="cn('relative w-full', insetClass)"
      :style="props.minWidth ? { minWidth: props.minWidth } : undefined"
    >
      <table
        data-slot="table"
        :class="tableClass"
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
          <TableRow class="h-8">
            <TableHead
              v-for="(column, index) in columns"
              :key="index"
              :class="column.align && ALIGN_CLASSES[column.align]"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <slot />
        <slot name="footer" />
      </table>
    </div>
  </div>
</template>

<style scoped>
/*
 * Reflow: below the declared step the body rows become stacked cards. One
 * rule set per step because container size queries cannot read a custom
 * property; the widths are Tailwind's container scale at the 14px root.
 * Unlayered on purpose: it must win over the utility classes on rows and
 * cells (heights, paddings) without a specificity contest.
 */
@container (width < 24rem) {
  [data-reflow='sm'] {
    --table-reflow: 1;
  }
}
@container (width < 28rem) {
  [data-reflow='md'] {
    --table-reflow: 1;
  }
}
@container (width < 32rem) {
  [data-reflow='lg'] {
    --table-reflow: 1;
  }
}
@container (width < 36rem) {
  [data-reflow='xl'] {
    --table-reflow: 1;
  }
}
@container (width < 42rem) {
  [data-reflow='2xl'] {
    --table-reflow: 1;
  }
}
@container (width < 48rem) {
  [data-reflow='3xl'] {
    --table-reflow: 1;
  }
}
@container (width < 56rem) {
  [data-reflow='4xl'] {
    --table-reflow: 1;
  }
}
@container (width < 64rem) {
  [data-reflow='5xl'] {
    --table-reflow: 1;
  }
}
@container (width < 72rem) {
  [data-reflow='6xl'] {
    --table-reflow: 1;
  }
}
@container (width < 80rem) {
  [data-reflow='7xl'] {
    --table-reflow: 1;
  }
}

/*
 * The card. Three tracks: label | value | actions. The primary cell is the
 * headline across label and value; the actions cell sits beside it on the
 * first row, where the row's actions belong; every meta cell is a definition
 * entry that subgrids into the label and value tracks, so labels align across
 * the whole card and the cell's own content keeps its stacking (a value with
 * its qualifier line stays two lines - the reflow never rearranges what is
 * inside a cell).
 */
@container style(--table-reflow: 1) {
  :deep([data-slot='table-head-band']),
  :deep(thead),
  :deep(colgroup) {
    display: none;
  }

  :deep([data-slot='table']),
  :deep([data-slot='table-body']) {
    display: block;
  }

  :deep([data-slot='table-body'] > tr) {
    display: grid;
    grid-template-columns: fit-content(9rem) minmax(0, 1fr) auto;
    column-gap: 0.75rem;
    row-gap: 0.25rem;
    align-items: start;
    height: auto;
    padding: 0.75rem 1rem;
  }

  :deep([data-slot='table-body'] > tr[aria-hidden]) {
    display: block;
    padding: 0;
    border: 0;
  }

  :deep([data-slot='table-body'] > tr > td) {
    min-width: 0;
    height: auto;
    padding: 0;
    text-align: start;
  }

  :deep([data-slot='table-body'] > tr > td[data-role='primary']) {
    display: block;
    grid-column: 1 / 3;
    margin-bottom: 0.5rem;
  }

  :deep([data-slot='table-body'] > tr > td[data-role='actions']) {
    display: block;
    grid-column: 3;
    grid-row: 1;
  }

  /* Column tone is a table-mode device; in the card the label carries the
     hierarchy and the value reads in the foreground. Values also step down to
     the meta role: in the table a value sits under a header and may use the
     content size, in the card it sits beside its label and the headline must
     be the only content-sized text. */
  :deep([data-slot='table-body'] > tr > td[data-role='meta']) {
    display: grid;
    grid-column: 1 / 3;
    grid-template-columns: subgrid;
    align-items: baseline;
    color: var(--color-foreground);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  :deep([data-slot='table-body'] > tr > td[data-role='meta'] .text-sm) {
    font-size: inherit;
    line-height: inherit;
  }

  /* A value reads from the label; centering that served the table column is
     undone here, whatever wrapper the cell used for it. */
  :deep([data-slot='table-body'] > tr > td[data-role='meta'] > *) {
    grid-column: 2;
    min-width: 0;
    justify-content: flex-start;
    text-align: start;
  }

  :deep([data-slot='table-body'] > tr > td[data-role='meta'][data-label]::before) {
    content: attr(data-label);
    grid-column: 1;
    grid-row: 1;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--color-muted-foreground);
  }
}
</style>
