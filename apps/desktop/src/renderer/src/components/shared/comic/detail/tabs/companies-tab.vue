<!--
  Comic Companies Tab

  Thin wrapper feeding comic company links into the shared role-links tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { EntityRoleLinksTab, type RoleLinkItem } from '@renderer/components/shared/entity'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { COMIC_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { comic, companies } = useComic()

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
    v-if="comic"
    entity-type="company"
    :entity-id="comic.id"
    :items="items"
    :role-order="COMIC_COMPANY_ROLE_VALUES"
    :role-labels="m.library.roles.comicCompany"
    link-view="comic-companies"
  />
</template>
