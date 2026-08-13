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
const { anime, persons } = useAnime()

const items = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({ id: link.id, role: link.role, entity: link.person }))
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
