<!--
  ContributionIcon - Renders a main-resolved extension contribution icon.

  Consumes ExtensionIconInfo: `mdi` names render through MdiIcon, `url` icons
  (extension package files) render as a currentColor CSS mask of the
  app-local URL. Both forms are monochrome silhouettes, so contribution icons
  follow the surrounding chrome color exactly like app icons; custom icon
  files should be single-color glyphs.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { ExtensionIconInfo } from '@shared/extension'
import { MdiIcon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  icon: ExtensionIconInfo
  class?: string
}>()

const fileMaskStyle = computed(() =>
  props.icon.kind === 'url'
    ? {
        backgroundColor: 'currentcolor',
        maskImage: `url("${props.icon.url}")`,
        maskSize: '100% 100%',
        maskRepeat: 'no-repeat'
      }
    : undefined
)
</script>

<template>
  <MdiIcon
    v-if="props.icon.kind === 'mdi'"
    :name="props.icon.name"
    :class="props.class"
  />
  <span
    v-else
    :class="cn('inline-block shrink-0', props.class)"
    :style="fileMaskStyle"
    aria-hidden="true"
  />
</template>
