<!--
  Movie Characters Tab

  Thin wrapper feeding movie character links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useMovie } from '@renderer/composables/use-movie'
import { useI18n } from '@renderer/composables/use-i18n'
import { MOVIE_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { movie, characters } = useMovie()

const items = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({ id: link.id, role: link.role, entity: link.character }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="movie"
    entity-type="character"
    :entity-id="movie.id"
    :items="items"
    :role-order="MOVIE_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.movieCharacter"
    link-view="movie-characters"
  />
</template>
