<!--
  Icon — zero-runtime icon via the iconify Tailwind plugin (CSS mask).

  Mirrors the app's icon API: pass an iconify utility class as the `icon` prop
  (form: icon-[<set>--<name>], e.g. the mdi set). The document's Tailwind build
  must register the iconify plugin and an icon-set data package for the classes
  to render. See the package README for the build setup.
-->
<script setup lang="ts">
import { cn } from '../../utils/cn'

const props = defineProps<{
  icon: string
  class?: string
}>()
</script>

<template>
  <span
    :class="cn(props.icon, props.class)"
    aria-hidden="true"
  />
</template>
