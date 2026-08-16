<!--
  Tv Persons Tab

  Thin wrapper feeding series person links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useTv } from '@renderer/composables/use-tv'
import { useI18n } from '@renderer/composables/use-i18n'
import { TV_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { tv, persons } = useTv()

const items = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({ id: link.id, role: link.role, entity: link.person }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="tv"
    entity-type="person"
    :entity-id="tv.id"
    :items="items"
    :role-order="TV_PERSON_ROLE_VALUES"
    :role-labels="m.library.roles.tvPerson"
    link-view="tv-persons"
  />
</template>
