<!--
  Game Persons Tab

  Thin wrapper feeding game person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { GAME_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { game, persons, cast } = useGame()

/**
 * Characters each person voices in this entry, so an actor credit reads as the
 * roles it covers rather than as a bare name.
 */
const rolesByPerson = computed(() => {
  const byPerson = new Map<string, string[]>()
  for (const credit of cast.value) {
    if (!credit.character) continue
    const names = byPerson.get(credit.personId) ?? []
    names.push(credit.character.name)
    byPerson.set(credit.personId, names)
  }
  return byPerson
})

const items = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({
    id: link.id,
    role: link.role,
    subtitle: rolesByPerson.value.get(link.personId)?.join(' / '),
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
