<!--
  Comic Persons Tab

  Thin wrapper feeding comic person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { COMIC_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { comic, persons } = useComic()

const items = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({
    id: link.id,
    role: link.role,
    entity: link.person
  }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="comic"
    entity-type="person"
    :entity-id="comic.id"
    :items="items"
    :role-order="COMIC_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.comicPerson"
    link-view="comic-persons"
  />
</template>
