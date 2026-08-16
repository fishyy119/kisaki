<!--
  Movie Companies Tab

  Thin wrapper feeding movie company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useMovie } from '@renderer/composables/use-movie'
import { useI18n } from '@renderer/composables/use-i18n'
import { MOVIE_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { movie, companies } = useMovie()

const items = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="movie"
    entity-type="company"
    :entity-id="movie.id"
    :items="items"
    :role-order="MOVIE_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.movieCompany"
    link-view="movie-companies"
  />
</template>
