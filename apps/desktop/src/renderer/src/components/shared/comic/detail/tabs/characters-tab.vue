<!--
  Comic Characters Tab

  Thin wrapper feeding comic character links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { COMIC_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { comic, characters } = useComic()

const items = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({
    id: link.id,
    role: link.role,
    entity: link.character
  }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="comic"
    entity-type="character"
    :entity-id="comic.id"
    :items="items"
    :role-order="COMIC_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.comicCharacter"
    link-view="comic-characters"
  />
</template>
