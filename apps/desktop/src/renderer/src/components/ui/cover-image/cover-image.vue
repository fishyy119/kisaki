<!--
  CoverImage - Image with unified icon fallback.

  Renders the image covering its container, or a gradient placeholder
  with the given icon when no source is available. Aspect ratio, size,
  rounding, and borders are supplied by the caller via class.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'

interface Props {
  src?: string | null
  alt?: string
  /** Fallback icon shown when src is empty */
  icon?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="cover-image"
    :class="cn('overflow-hidden bg-muted', props.class)"
  >
    <img
      v-if="props.src"
      :src="props.src"
      :alt="props.alt"
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
    />
    <div
      v-else
      class="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50"
    >
      <Icon
        v-if="props.icon"
        :icon="props.icon"
        class="size-8 text-muted-foreground/50"
      />
    </div>
  </div>
</template>
