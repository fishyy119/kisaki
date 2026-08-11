<!--
  GameCard
  Pure display component for rendering a game in lists/grids.
  Supports both 'card' (default) and 'button' variants.
  Click behavior is controlled by the caller via @click emit.
  Right-click shows context menu for both variants.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { useGameActivityStore } from '@renderer/stores'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import type { ButtonVariants } from '@renderer/components/ui/button'
import {
  MediaCard,
  MediaCardButton,
  type MediaCardAlign,
  type MediaCardSize
} from '@renderer/components/ui/media-card'
import { GameContextMenu } from './menus'
import type { Game } from '@shared/db'

interface Props {
  game: Game
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

const gameActivityStore = useGameActivityStore()
const isRunning = computed(() => gameActivityStore.isGameRunning(props.game.id))

const imageUrl = computed(() =>
  props.game.coverFile
    ? getAttachmentUrl('games', props.game.id, props.game.coverFile, { width: 300, height: 400 })
    : null
)
</script>

<template>
  <GameContextMenu :game-id="props.game.id">
    <MediaCard
      v-if="props.variant === 'card'"
      :name="props.game.name"
      :image-url="imageUrl"
      :fallback-icon="getEntityIcon('game')"
      :size="props.size"
      :align="props.align"
      :hide-name="props.hideName"
      :badge-label="props.badgeLabel"
      :clickable="props.clickable"
      :class="props.class"
      @click="emit('click')"
    >
      <template
        v-if="isRunning"
        #overlay
      >
        <div class="absolute top-1 right-1 size-2 rounded-full bg-success animate-pulse" />
      </template>
    </MediaCard>

    <MediaCardButton
      v-else
      :name="props.game.name"
      :variant="props.buttonVariant"
      :size="props.buttonSize"
      :class="props.class"
      @click="emit('click')"
    />
  </GameContextMenu>
</template>
