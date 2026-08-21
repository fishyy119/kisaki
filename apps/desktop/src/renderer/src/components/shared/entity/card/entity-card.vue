<!--
  EntityCard
  Unified wrapper component that renders the appropriate entity-specific card
  based on the provided entityType. Eliminates repetitive v-if/v-else-if chains.

  Usage:
    <EntityCard
      entity-type="game"
      :entity="gameData"
      size="md"
      @click="handleClick"
    />
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { GameCard } from '@renderer/components/shared/game'
import { AnimeCard } from '@renderer/components/shared/anime'
import { CharacterCard } from '@renderer/components/shared/character'
import { PersonCard } from '@renderer/components/shared/person'
import { CompanyCard } from '@renderer/components/shared/company'
import { CollectionCard } from '@renderer/components/shared/collection'
import { TagCard } from '@renderer/components/shared/tag'
import type { ButtonVariants } from '@renderer/components/ui/button'
import type { AllEntityType } from '@shared/common'
import type { Anime, Game, Character, Person, Company, Collection, Tag } from '@shared/db'

type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type CardAlign = 'left' | 'center' | 'right'

// Union type for all possible entity data
type EntityData = Game | Anime | Character | Person | Company | Collection | Tag

interface Props {
  entityType: AllEntityType
  entity: EntityData
  // Card variant props (for content entities)
  variant?: 'card' | 'button'
  size?: CardSize
  /** Secondary line under the name; ignored by the tag and collection cards */
  subtitle?: string
  hideName?: boolean
  badgeLabel?: string
  align?: CardAlign
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
</script>

<template>
  <!-- Game -->
  <GameCard
    v-if="props.entityType === 'game'"
    :game="props.entity as Game"
    :variant="props.variant"
    :size="props.size"
    :subtitle="props.subtitle"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Anime -->
  <AnimeCard
    v-else-if="props.entityType === 'anime'"
    :anime="props.entity as Anime"
    :variant="props.variant"
    :size="props.size"
    :subtitle="props.subtitle"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Character -->
  <CharacterCard
    v-else-if="props.entityType === 'character'"
    :character="props.entity as Character"
    :variant="props.variant"
    :size="props.size"
    :subtitle="props.subtitle"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Person -->
  <PersonCard
    v-else-if="props.entityType === 'person'"
    :person="props.entity as Person"
    :variant="props.variant"
    :size="props.size"
    :subtitle="props.subtitle"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Company -->
  <CompanyCard
    v-else-if="props.entityType === 'company'"
    :company="props.entity as Company"
    :variant="props.variant"
    :size="props.size"
    :subtitle="props.subtitle"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Collection -->
  <CollectionCard
    v-else-if="props.entityType === 'collection'"
    :collection="props.entity as Collection"
    :variant="props.variant"
    :size="props.size"
    :hide-name="props.hideName"
    :badge-label="props.badgeLabel"
    :align="props.align"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Tag (different structure, fewer props) -->
  <TagCard
    v-else-if="props.entityType === 'tag'"
    :tag="props.entity as Tag"
    :variant="props.variant"
    :size="props.size"
    :badge-label="props.badgeLabel"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />
</template>
