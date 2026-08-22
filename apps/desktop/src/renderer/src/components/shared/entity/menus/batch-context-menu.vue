<!--
  EntityBatchContextMenu
  Context menu shell for batch operations on multiple entries of one entity
  type.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent
} from '@renderer/components/ui/context-menu'
import type { ContentEntityType } from '@shared/common'
import { EntityBatchDeleteFormDialog } from '../delete'
import { EntityBatchMetadataUpdateFormDialog } from '../metadata'
import EntityBatchMenuItems from './batch-menu-items.vue'

interface Props {
  entityType: ContentEntityType
  entityIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [entityIds: string[]]
}>()

const menuOpen = ref(false)
const deleteDialogOpen = ref(false)
const metadataUpdateDialogOpen = ref(false)
</script>

<template>
  <ContextMenu v-model:open="menuOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <EntityBatchMenuItems
        :entity-type="props.entityType"
        :entity-ids="props.entityIds"
        :enabled="menuOpen"
        @open-metadata-update-dialog="metadataUpdateDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
      />
    </ContextMenuContent>
  </ContextMenu>

  <EntityBatchDeleteFormDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-type="props.entityType"
    :entity-ids="props.entityIds"
    @deleted="emit('deleted', $event)"
  />

  <EntityBatchMetadataUpdateFormDialog
    v-if="metadataUpdateDialogOpen"
    v-model:open="metadataUpdateDialogOpen"
    :entity-type="props.entityType"
    :entity-ids="props.entityIds"
  />
</template>
