<!--
  CharacterWorksTab
  Every media appearance of the character, blocked by media kind and
  role-grouped.
-->
<script setup lang="ts">
import { EntityWorksTab } from '@renderer/components/shared/entity'
import { useCharacter } from '@renderer/composables/use-character'
import { useCharacterWorksBlocks } from '../works'

const { character } = useCharacter()
const blocks = useCharacterWorksBlocks()
</script>

<template>
  <EntityWorksTab
    v-if="character"
    :entity-id="character.id"
    :blocks="blocks"
  />
</template>
