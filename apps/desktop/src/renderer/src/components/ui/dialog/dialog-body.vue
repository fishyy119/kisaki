<!--
  DialogBody - The dialog's scroll viewport, and the only part of a dialog that
  ever scrolls.

  A ScrollRegion with the dialog's default padding. Inside the slab's flex
  column it takes whatever height the header and footer leave and scrolls
  beyond it: in a content-sized dialog that is as tall as its content up to the
  slab ceiling, in a `fill` dialog it is the remaining definite height. Callers
  never cap it; the slab owns the geometry. It hosts the back-to-top device and
  is the scroll parent of every virtual list inside the dialog
  (`scroll="region"`).
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
