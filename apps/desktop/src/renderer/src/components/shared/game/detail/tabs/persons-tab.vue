<!--
  Game Persons Tab

  Thin wrapper feeding game person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatPlaying } from '@renderer/utils/format'
import { GAME_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { game, persons } = useGame()

const items = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({
    id: link.id,
    role: link.role,
    subtitle: formatPlaying(link.playing),
    entity: link.person
  }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="game"
    entity-type="person"
    :entity-id="game.id"
    :items="items"
    :role-order="GAME_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.gamePerson"
    link-view="game-persons"
  />
</template>
