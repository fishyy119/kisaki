<!--
  MediaCard - Poster-style card for library entities.

  Cover image with fallback icon, hover scale, optional name line and
  badge label. Entity wrappers own data mapping, context menus, and
  overlay indicators (via #overlay).
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@renderer/utils/cn'
import { Badge } from '@renderer/components/ui/badge'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { HoverScaleImage } from '@renderer/components/ui/hover-scale-image'
import type { MediaCardAlign, MediaCardSize } from './types'

const cardVariants = cva('group relative flex-shrink-0 flex flex-col', {
  variants: {
    size: {
      xs: 'w-20',
      sm: 'w-24',
      md: 'w-32',
      lg: 'w-40',
      xl: 'w-48'
    }
  },
  defaultVariants: { size: 'md' }
})

const alignStyles: Record<MediaCardAlign, { container: string; text: string }> = {
  left: { container: 'items-start', text: 'text-left' },
  center: { container: 'items-center', text: 'text-center' },
  right: { container: 'items-end', text: 'text-right' }
}

interface Props {
  name: string
  imageUrl?: string | null
  /** Fallback icon when there is no image */
  fallbackIcon?: string
  aspect?: 'portrait' | 'square'
  size?: MediaCardSize
  align?: MediaCardAlign
  hideName?: boolean
  badgeLabel?: string
  clickable?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  aspect: 'portrait',
  size: 'md',
  align: 'center',
  clickable: true
})

const emit = defineEmits<{
  click: []
}>()

const alignStyle = computed(() => alignStyles[props.align])
</script>

<template>
  <div
    data-slot="media-card"
    :class="
      cn(cardVariants({ size: props.size }), props.clickable && 'cursor-pointer', props.class)
    "
    @click="emit('click')"
  >
    <div
      :class="
        cn(
          'relative rounded-lg overflow-hidden bg-muted border shadow-raised',
          props.aspect === 'portrait' ? 'aspect-[3/4]' : 'aspect-square'
        )
      "
    >
      <HoverScaleImage class="size-full">
        <CoverImage
          :src="props.imageUrl"
          :alt="props.name"
          :icon="props.fallbackIcon"
          class="size-full"
        />
      </HoverScaleImage>

      <slot name="overlay" />
    </div>

    <!-- Name with badge -->
    <template v-if="props.badgeLabel">
      <div :class="cn('mt-1.5 flex flex-col w-full', alignStyle.container)">
        <p :class="cn('text-xs font-medium truncate w-full px-1 hover:underline', alignStyle.text)">
          {{ props.name }}
        </p>
        <Badge
          variant="secondary"
          class="mt-1 text-[10px] px-1.5 py-0"
        >
          {{ props.badgeLabel }}
        </Badge>
      </div>
    </template>

    <!-- Name only -->
    <p
      v-else-if="!props.hideName"
      :class="
        cn(
          'mt-1.5 text-xs font-medium truncate w-full text-foreground/90 hover:underline',
          alignStyle.text
        )
      "
    >
      {{ props.name }}
    </p>
  </div>
</template>
