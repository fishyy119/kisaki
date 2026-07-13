<!--
  PersonCard
  Pure display component for rendering a person in lists/grids.
  Supports both 'card' (default) and 'button' variants.
  Click behavior is controlled by the caller via @click emit.
  Right-click shows context menu for both variants.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import type { ButtonVariants } from '@renderer/components/ui/button'
import {
  MediaCard,
  MediaCardButton,
  type MediaCardAlign,
  type MediaCardSize
} from '@renderer/components/ui/media-card'
import { PersonContextMenu } from './menus'
import type { Person } from '@shared/db'

interface Props {
  person: Person
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
  props.person.photoFile
    ? getAttachmentUrl('persons', props.person.id, props.person.photoFile, {
        width: 300,
        height: 400
      })
    : null
)
</script>

<template>
  <PersonContextMenu :person-id="props.person.id">
    <MediaCard
      v-if="props.variant === 'card'"
      :name="props.person.name"
      :image-url="imageUrl"
      :fallback-icon="getEntityIcon('person')"
      :size="props.size"
      :align="props.align"
      :hide-name="props.hideName"
      :badge-label="props.badgeLabel"
      :clickable="props.clickable"
      :class="props.class"
      @click="emit('click')"
    />

    <MediaCardButton
      v-else
      :name="props.person.name"
      :variant="props.buttonVariant"
      :size="props.buttonSize"
      :class="props.class"
      @click="emit('click')"
    />
  </PersonContextMenu>
</template>
