<!--
  CollectionCard
  Pure display component for rendering a collection in lists/grids.
  Supports both 'card' (default) and 'button' variants.
  Click behavior is controlled by the caller via @click emit.
  Right-click shows context menu for both variants.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'
import type { ButtonVariants } from '@renderer/components/ui/button'
import {
  MediaCard,
  MediaCardButton,
  type MediaCardAlign,
  type MediaCardSize
} from '@renderer/components/ui/media-card'
import { CollectionContextMenu } from './menus'
import type { Collection } from '@shared/db'

interface Props {
  collection: Collection
  variant?: 'card' | 'button'
  // Card variant props
  size?: MediaCardSize
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

const imageUrl = computed(() =>
  getEntityImageUrl('collection', props.collection, 'cover', { width: 300, height: 300 })
)
</script>

<template>
  <CollectionContextMenu :collection-id="props.collection.id">
    <MediaCard
      v-if="props.variant === 'card'"
      :name="props.collection.name"
      :image-url="imageUrl"
      :fallback-icon="getEntityIcon('collection')"
      aspect="square"
      :size="props.size"
      :align="props.align"
      :hide-name="props.hideName"
      :badge-label="props.badgeLabel"
      :clickable="props.clickable"
      :class="props.class"
      @click="emit('click')"
    >
      <template
        v-if="props.collection.isDynamic"
        #overlay
      >
        <!-- Dynamic collection indicator badge -->
        <div
          class="absolute top-1 right-1 size-5 rounded-full bg-primary/90 flex items-center justify-center"
        >
          <Icon
            icon="icon-[mdi--lightning-bolt]"
            class="size-3 text-primary-foreground"
          />
        </div>
      </template>
    </MediaCard>

    <MediaCardButton
      v-else
      :name="props.collection.name"
      :variant="props.buttonVariant"
      :size="props.buttonSize"
      :class="props.class"
      @click="emit('click')"
    />
  </CollectionContextMenu>
</template>
