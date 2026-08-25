<!--
  Novel Characters Tab

  Thin wrapper feeding novel character links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { NOVEL_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { novel, characters } = useNovel()

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
    v-if="novel"
    entity-type="character"
    :entity-id="novel.id"
    :items="items"
    :role-order="NOVEL_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.novelCharacter"
    link-view="novel-characters"
  />
</template>
