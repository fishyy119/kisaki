<!--
  EntityDetailDialog
  Mounts the detail dialog of whichever entity a surface asked to open. Owns the
  "no target means closed" rule, so lists only carry the target they picked.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { DETAIL_DIALOGS, type EntityDetailTarget } from './dialogs'

const target = defineModel<EntityDetailTarget | null>('target', { required: true })

const dialog = computed(() => (target.value ? DETAIL_DIALOGS[target.value.entityType]() : null))

const open = computed({
  get: () => target.value !== null,
  set: (value) => {
    if (!value) target.value = null
  }
})
</script>

<template>
  <component
    :is="dialog"
    v-if="target"
    v-model:open="open"
    :entity-id="target.entityId"
  />
</template>
