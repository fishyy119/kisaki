<!--
  Game Characters Tab

  Thin wrapper feeding game character links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { GAME_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { game, characters } = useGame()

const items = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({ id: link.id, role: link.role, entity: link.character }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="game"
    entity-type="character"
    :entity-id="game.id"
    :items="items"
    :role-order="GAME_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.gameCharacter"
    link-view="game-characters"
  />
</template>
