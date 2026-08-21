<!--
  Anime Persons Tab

  Thin wrapper feeding anime person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { ANIME_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { anime, persons, cast } = useAnime()

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
    v-if="anime"
    entity-type="person"
    :entity-id="anime.id"
    :items="items"
    :role-order="ANIME_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.animePerson"
    link-view="anime-persons"
  />
</template>
