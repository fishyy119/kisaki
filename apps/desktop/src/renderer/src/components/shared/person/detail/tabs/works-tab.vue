<!--
  PersonWorksTab
  Every media credit of the person, blocked by media kind and role-grouped.
-->
<script setup lang="ts">
import { EntityWorksTab } from '@renderer/components/shared/entity'
import { usePerson } from '@renderer/composables/use-person'
import { usePersonWorksBlocks } from '../works'

const { person } = usePerson()
const blocks = usePersonWorksBlocks()
</script>

<template>
  <EntityWorksTab
    v-if="person"
    :entity-id="person.id"
    :blocks="blocks"
  />
</template>
