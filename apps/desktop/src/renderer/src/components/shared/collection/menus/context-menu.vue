<!--
  CollectionContextMenu

  Context menu for collection items (right-click menu).
  Dialog states are managed here to prevent unmount issues when menu closes.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem
} from '@renderer/components/ui/context-menu'
import CollectionMenuItems from './menu-items.vue'
import {
  CollectionInfoFormDialog,
  CollectionEntitiesFormDialog,
  CollectionDynamicConfigFormDialog,
  CollectionConvertToStaticFormDialog
} from '../forms'
import { EntityMergeDialog, EntityDeleteFormDialog } from '@renderer/components/shared/entity'
import type { MenuComponents } from '@renderer/types'

interface Props {
  collectionId: string
}

const props = defineProps<Props>()

// Context menu components adapter
const contextMenuComponents: MenuComponents = {
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Separator: ContextMenuSeparator,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem
}

// Menu open state for lazy loading
const menuOpen = ref(false)

// Dialog states managed by parent to survive menu close
const deleteDialogOpen = ref(false)
const editMetadataDialogOpen = ref(false)
const editEntitiesDialogOpen = ref(false)
const editFilterDialogOpen = ref(false)
const convertDialogOpen = ref(false)
const mergeDialogOpen = ref(false)
</script>

<template>
  <ContextMenu @update:open="menuOpen = $event">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <CollectionMenuItems
        :collection-id="props.collectionId"
        :components="contextMenuComponents"
        :enabled="menuOpen"
        @open-edit-metadata-dialog="editMetadataDialogOpen = true"
        @open-edit-entities-dialog="editEntitiesDialogOpen = true"
        @open-edit-filter-dialog="editFilterDialogOpen = true"
        @open-convert-dialog="convertDialogOpen = true"
        @open-merge-dialog="mergeDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
      />
    </ContextMenuContent>
  </ContextMenu>

  <!-- Dialogs rendered outside menu to survive menu close -->
  <EntityDeleteFormDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    entity-type="collection"
    :entity-id="props.collectionId"
  />

  <CollectionInfoFormDialog
    v-if="editMetadataDialogOpen"
    v-model:open="editMetadataDialogOpen"
    :collection-id="props.collectionId"
  />

  <EntityMergeDialog
    v-if="mergeDialogOpen"
    v-model:open="mergeDialogOpen"
    entity-type="collection"
    :target-id="props.collectionId"
  />

  <CollectionEntitiesFormDialog
    v-if="editEntitiesDialogOpen"
    v-model:open="editEntitiesDialogOpen"
    :collection-id="props.collectionId"
  />

  <CollectionDynamicConfigFormDialog
    v-if="editFilterDialogOpen"
    v-model:open="editFilterDialogOpen"
    :collection-id="props.collectionId"
  />

  <!-- Convert to static confirmation -->
  <CollectionConvertToStaticFormDialog
    v-if="convertDialogOpen"
    v-model:open="convertDialogOpen"
    :collection-id="props.collectionId"
  />
</template>
