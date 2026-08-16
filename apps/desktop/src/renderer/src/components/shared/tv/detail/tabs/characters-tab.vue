<!--
  Tv Characters Tab

  Thin wrapper feeding series character links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useTv } from '@renderer/composables/use-tv'
import { useI18n } from '@renderer/composables/use-i18n'
import { TV_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { tv, characters } = useTv()

const items = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({ id: link.id, role: link.role, entity: link.character }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="tv"
    entity-type="character"
    :entity-id="tv.id"
    :items="items"
    :role-order="TV_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.tvCharacter"
    link-view="tv-characters"
  />
</template>
