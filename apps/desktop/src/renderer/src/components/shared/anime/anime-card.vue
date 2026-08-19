<!--
  AnimeCard
  Pure display component for rendering an anime entry in lists/grids.
  Supports both 'card' (default) and 'button' variants.
  Click behavior is controlled by the caller via @click emit.
  Right-click shows context menu for both variants.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { useAnimeActivityStore } from '@renderer/stores'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import type { ButtonVariants } from '@renderer/components/ui/button'
import {
  MediaCard,
  MediaCardButton,
  type MediaCardAlign,
  type MediaCardSize
} from '@renderer/components/ui/media-card'
import type { Anime } from '@shared/db'
import { EntityContextMenu } from '@renderer/components/shared/entity'

interface Props {
  anime: Anime
  variant?: 'card' | 'button'
  // Card variant props
  size?: MediaCardSize
  /** Secondary line under the name, such as the characters played in this entry */
  subtitle?: string
  hideName?: boolean
  badgeLabel?: string
  align?: MediaCardAlign
  // Button variant props
  buttonVariant?: ButtonVariants['variant']
  buttonSize?: ButtonVariants['size']
  // Common
  clickable?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'card',
  size: 'md',
  align: 'center',
  buttonVariant: 'secondary',
  buttonSize: 'sm',
  clickable: true
})

const emit = defineEmits<{
  click: []
}>()

const animeActivityStore = useAnimeActivityStore()
const isWatching = computed(() => animeActivityStore.isAnimeWatching(props.anime.id))

const imageUrl = computed(() =>
  props.anime.coverFile
    ? getAttachmentUrl('animes', props.anime.id, props.anime.coverFile, { width: 300, height: 400 })
    : null
)
</script>

<template>
  <EntityContextMenu
    entity-type="anime"
    :entity-id="props.anime.id"
  >
    <MediaCard
      v-if="props.variant === 'card'"
      :name="props.anime.name"
      :subtitle="props.subtitle"
      :image-url="imageUrl"
      :fallback-icon="getEntityIcon('anime')"
      :size="props.size"
      :align="props.align"
      :hide-name="props.hideName"
      :badge-label="props.badgeLabel"
      :clickable="props.clickable"
      :class="props.class"
      @click="emit('click')"
    >
      <template
        v-if="isWatching"
        #overlay
      >
        <div class="absolute top-1 right-1 size-2 rounded-full bg-success animate-pulse" />
      </template>
    </MediaCard>

    <MediaCardButton
      v-else
      :name="props.anime.name"
      :variant="props.buttonVariant"
      :size="props.buttonSize"
      :class="props.class"
      @click="emit('click')"
    />
  </EntityContextMenu>
</template>
