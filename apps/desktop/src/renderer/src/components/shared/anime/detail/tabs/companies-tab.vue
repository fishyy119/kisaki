<!--
  Anime Companies Tab

  Thin wrapper feeding anime company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { ANIME_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { anime, companies } = useAnime()

const items = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="anime"
    entity-type="company"
    :entity-id="anime.id"
    :items="items"
    :role-order="ANIME_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.animeCompany"
    link-view="anime-companies"
  />
</template>
