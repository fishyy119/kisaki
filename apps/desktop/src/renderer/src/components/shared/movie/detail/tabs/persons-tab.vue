<!--
  Movie Persons Tab

  Thin wrapper feeding movie person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useMovie } from '@renderer/composables/use-movie'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatPlaying } from '@renderer/utils/format'
import { MOVIE_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { movie, persons } = useMovie()

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
    v-if="movie"
    entity-type="person"
    :entity-id="movie.id"
    :items="items"
    :role-order="MOVIE_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.moviePerson"
    link-view="movie-persons"
  />
</template>
