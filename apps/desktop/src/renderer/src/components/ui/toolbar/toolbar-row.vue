<!--
  ToolbarRow
  One row of a Toolbar. A container query root, so controls inside can
  collapse (tab labels to icons) by the width they actually get.
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
    :class="cn('@container flex min-w-0 items-center gap-3', props.class)"
  >
    <slot />
  </div>
</template>
