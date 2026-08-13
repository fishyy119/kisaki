<!--
  EntityMenuDialogs
  Shared dialog assembly behind the entity menus. Rendered outside the menu
  content so dialogs survive menu close; shells open dialogs through the
  exposed `open(name)` handle.
-->
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { CollectionInfoFormDialog } from '@renderer/components/shared/collection'
import type { TableEntityType } from '../entity-tables'
import { EntityScoreFormDialog } from '../fields'
import { EntityExternalIdsFormDialog } from '../identities'
import { EntityMergeDialog } from '../merge'
import { EntityDeleteFormDialog } from '../delete'
import { EntityMetadataUpdateFormDialog } from '../metadata'
import { EntityAssetsFormDialog } from '../assets'
import { MENU_SPECS } from './menu-specs'

interface Props {
  entityType: TableEntityType
  entityId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [entityId: string]
}>()

const spec = computed(() => MENU_SPECS[props.entityType])

const openDialogs = reactive({
  score: false,
  assets: false,
  metadataUpdate: false,
  externalIds: false,
  merge: false,
  delete: false,
  newCollection: false
})

/** Currently open media-specific dialog name, or null. */
const extraOpen = ref<string | null>(null)

function open(name: string) {
  if (name in openDialogs) {
    openDialogs[name as keyof typeof openDialogs] = true
    return
  }
  extraOpen.value = name
}

defineExpose({ open })

const extraOpenModel = computed({
  get: () => extraOpen.value !== null,
  set: (value: boolean) => {
    if (!value) extraOpen.value = null
  }
})

const activeExtra = computed(
  () => spec.value.extraDialogs.find((dialog) => dialog.name === extraOpen.value) ?? null
)
</script>

<template>
  <EntityDeleteFormDialog
    v-if="openDialogs.delete"
    v-model:open="openDialogs.delete"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    @deleted="emit('deleted', $event)"
  />

  <EntityScoreFormDialog
    v-if="openDialogs.score"
    v-model:open="openDialogs.score"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
  />

  <EntityAssetsFormDialog
    v-if="openDialogs.assets"
    v-model:open="openDialogs.assets"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
  />

  <EntityMetadataUpdateFormDialog
    v-if="openDialogs.metadataUpdate"
    v-model:open="openDialogs.metadataUpdate"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
  />

  <EntityExternalIdsFormDialog
    v-if="openDialogs.externalIds"
    v-model:open="openDialogs.externalIds"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
  />

  <EntityMergeDialog
    v-if="openDialogs.merge"
    v-model:open="openDialogs.merge"
    :entity-type="props.entityType"
    :target-id="props.entityId"
  />

  <CollectionInfoFormDialog
    v-if="openDialogs.newCollection"
    v-model:open="openDialogs.newCollection"
    :entity-to-add="{ type: props.entityType, id: props.entityId }"
  />

  <!-- Media-specific dialog declared by the menu spec -->
  <component
    :is="activeExtra.component"
    v-if="activeExtra"
    v-model:open="extraOpenModel"
    v-bind="activeExtra.buildProps(props.entityId)"
  />
</template>
