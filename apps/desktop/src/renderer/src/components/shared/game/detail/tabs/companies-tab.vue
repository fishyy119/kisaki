<!--
  Game Companies Tab

  Thin wrapper feeding game company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { GAME_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { game, companies } = useGame()

const items = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="game"
    entity-type="company"
    :entity-id="game.id"
    :items="items"
    :role-order="GAME_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.gameCompany"
    link-view="game-companies"
  />
</template>
