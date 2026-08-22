<!--
  CompanyCard
  Pure display component for rendering a company in lists/grids.
  Supports both 'card' (default) and 'button' variants.
  Click behavior is controlled by the caller via @click emit.
  Right-click shows context menu for both variants.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'
import type { ButtonVariants } from '@renderer/components/ui/button'
import {
  MediaCard,
  MediaCardButton,
  type MediaCardAlign,
  type MediaCardSize
} from '@renderer/components/ui/media-card'
import type { Company } from '@shared/db'
import { EntityContextMenu } from '@renderer/components/shared/entity'

interface Props {
  company: Company
  variant?: 'card' | 'button'
  // Card variant props
  size?: MediaCardSize
  /** Secondary line under the name */
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

const imageUrl = computed(() =>
  getEntityImageUrl('company', props.company, 'cover', { width: 300, height: 300 })
)
</script>

<template>
  <EntityContextMenu
    entity-type="company"
    :entity-id="props.company.id"
  >
    <MediaCard
      v-if="props.variant === 'card'"
      :name="props.company.name"
      :subtitle="props.subtitle"
      :image-url="imageUrl"
      :fallback-icon="getEntityIcon('company')"
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
      :name="props.company.name"
      :variant="props.buttonVariant"
      :size="props.buttonSize"
      :class="props.class"
      @click="emit('click')"
    />
  </EntityContextMenu>
</template>
