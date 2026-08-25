<!--
  Novel Companies Tab

  Thin wrapper feeding novel company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { NOVEL_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { novel, companies } = useNovel()

const items = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({
    id: link.id,
    role: link.role,
    entity: link.company
  }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="novel"
    entity-type="company"
    :entity-id="novel.id"
    :items="items"
    :role-order="NOVEL_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.novelCompany"
    link-view="novel-companies"
  />
</template>
