<!--
  DialogBody - The dialog's scroll viewport.

  A ScrollRegion without memory: a dialog is an instance-scoped overlay, so
  its offset belongs to nothing that outlives it. It hosts the back-to-top
  device and is the scroll parent of every virtual list inside the dialog
  (`scroll-parent="region"`). Inside a `flex flex-col` DialogContent with a
  max height it takes the remaining space and scrolls; elsewhere it grows with
  its content, and a max height passed through `class` caps it.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <ScrollRegion :class="cn('px-4 py-3', props.class)">
    <slot />
  </ScrollRegion>
</template>
