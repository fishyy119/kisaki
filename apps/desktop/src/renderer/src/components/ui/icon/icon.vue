<!--
  Icon - Zero JS runtime icon component using Tailwind CSS

  Uses @iconify/tailwind4 plugin which renders icons via CSS mask-image.
  Icons are automatically tree-shaken at build time.

  Usage:
    <Icon icon="icon-[mdi--home]" class="size-5" />
    <Icon :icon="config.icon" class="size-4 text-primary" />
-->
<script setup lang="ts">
import { cn } from '@renderer/utils/cn'

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
