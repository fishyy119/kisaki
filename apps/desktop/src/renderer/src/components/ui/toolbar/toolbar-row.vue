<!--
  ToolbarRow
  One row of a Toolbar: a leading part (the flexible control - a search field -
  and what qualifies it) and a `trailing` group (fixed-size controls: filters,
  selects, sort). The row wraps rather than squeezing: when the leading floor
  and the trailing group no longer share a line, the group drops to a second
  line, right-aligned, and the leading control keeps the first line whole.
  A query container: the shrink-to-fit controls inside cannot measure
  themselves, so they collapse by the width this row actually gets.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="toolbar-row"
    :class="cn('@container flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2', props.class)"
  >
    <slot />

    <div
      v-if="$slots.trailing"
      data-slot="toolbar-trailing"
      class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3"
    >
      <slot name="trailing" />
    </div>
  </div>
</template>
