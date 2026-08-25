<!--
  Novel Persons Tab

  Thin wrapper feeding novel person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { NOVEL_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { novel, persons } = useNovel()

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
    v-if="novel"
    entity-type="person"
    :entity-id="novel.id"
    :items="items"
    :role-order="NOVEL_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.novelPerson"
    link-view="novel-persons"
  />
</template>
