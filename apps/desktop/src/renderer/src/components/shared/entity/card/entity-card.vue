<!--
  EntityCard
  Renders whichever entity card the given type calls for, so grids and lists
  carry no per-entity branches.

  The card props are typed against the entity type: passing a row of the wrong
  entity is a compile error at the call site.

  Usage:
    <EntityCard
      entity-type="game"
      :entity="gameData"
      size="md"
      @click="handleClick"
    />
-->
<script setup lang="ts" generic="T extends AllEntityType">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { GameCard } from '@renderer/components/shared/game'
import { AnimeCard } from '@renderer/components/shared/anime'
import { ComicCard } from '@renderer/components/shared/comic'
import { NovelCard } from '@renderer/components/shared/novel'
import { CharacterCard } from '@renderer/components/shared/character'
import { PersonCard } from '@renderer/components/shared/person'
import { CompanyCard } from '@renderer/components/shared/company'
import { CollectionCard } from '@renderer/components/shared/collection'
import { TagCard } from '@renderer/components/shared/tag'
import type { ButtonVariants } from '@renderer/components/ui/button'
import type { EntityRowMap } from '@renderer/core/db'
import type { AllEntityType } from '@shared/entity-types'
import { assertNever } from '@shared/utils/exhaustive'

type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type CardAlign = 'left' | 'center' | 'right'

interface Props {
  entityType: T
  entity: EntityRowMap[T]
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

/**
 * The type and its row as one value, so the template narrows both together and
 * each card receives the row it declares. The pair is correlated by the props
 * of this component; TypeScript cannot see that through the type parameter, so
 * it is stated once here.
 */
type EntityCardTarget = {
  [K in AllEntityType]: { entityType: K; entity: EntityRowMap[K] }
}[AllEntityType]

const target = computed(
  () => ({ entityType: props.entityType, entity: props.entity }) as EntityCardTarget
)
</script>

<template>
  <GameCard
    v-if="target.entityType === 'game'"
    :game="target.entity"
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

  <AnimeCard
    v-else-if="target.entityType === 'anime'"
    :anime="target.entity"
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

  <ComicCard
    v-else-if="target.entityType === 'comic'"
    :comic="target.entity"
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

  <NovelCard
    v-else-if="target.entityType === 'novel'"
    :novel="target.entity"
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

  <CharacterCard
    v-else-if="target.entityType === 'character'"
    :character="target.entity"
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

  <PersonCard
    v-else-if="target.entityType === 'person'"
    :person="target.entity"
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

  <CompanyCard
    v-else-if="target.entityType === 'company'"
    :company="target.entity"
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

  <!-- A collection has no secondary line of its own -->
  <CollectionCard
    v-else-if="target.entityType === 'collection'"
    :collection="target.entity"
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

  <!-- A tag renders as a chip, so it takes neither name nor alignment props -->
  <TagCard
    v-else-if="target.entityType === 'tag'"
    :tag="target.entity"
    :variant="props.variant"
    :size="props.size"
    :badge-label="props.badgeLabel"
    :button-variant="props.buttonVariant"
    :button-size="props.buttonSize"
    :clickable="props.clickable"
    :class="props.class"
    @click="emit('click')"
  />

  <!-- Every entity type is handled above; a new one fails to compile here -->
  <template v-else>{{ assertNever(target, 'entity card type') }}</template>
</template>
