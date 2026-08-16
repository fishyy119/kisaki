<!--
  CompanyWorksTab
  Every media credit of the company, blocked by media kind and role-grouped.
-->
<script setup lang="ts">
import { EntityWorksTab } from '@renderer/components/shared/entity'
import { useCompany } from '@renderer/composables/use-company'
import { useCompanyWorksBlocks } from '../works'

const { company } = useCompany()
const blocks = useCompanyWorksBlocks()
</script>

<template>
  <EntityWorksTab
    v-if="company"
    :entity-id="company.id"
    :blocks="blocks"
  />
</template>
