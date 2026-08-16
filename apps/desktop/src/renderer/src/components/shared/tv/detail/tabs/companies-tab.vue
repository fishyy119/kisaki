<!--
  Tv Companies Tab

  Thin wrapper feeding series company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useTv } from '@renderer/composables/use-tv'
import { useI18n } from '@renderer/composables/use-i18n'
import { TV_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { tv, companies } = useTv()

const items = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="tv"
    entity-type="company"
    :entity-id="tv.id"
    :items="items"
    :role-order="TV_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.tvCompany"
    link-view="tv-companies"
  />
</template>
