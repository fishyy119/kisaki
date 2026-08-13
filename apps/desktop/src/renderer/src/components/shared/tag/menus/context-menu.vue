<!--
  TagContextMenu
  Context menu for tag items (right-click menu).
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
import { TagInfoFormDialog } from '../forms'
import { EntityMergeDialog, EntityDeleteFormDialog } from '@renderer/components/shared/entity'
import TagMenuItems from './menu-items.vue'
import type { MenuComponents } from '@renderer/types'

interface Props {
  tagId: string
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
const editDialogOpen = ref(false)
const mergeDialogOpen = ref(false)
</script>

<template>
  <ContextMenu v-model:open="menuOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <TagMenuItems
        :tag-id="props.tagId"
        :components="contextMenuComponents"
        :enabled="menuOpen"
        @open-edit-dialog="editDialogOpen = true"
        @open-merge-dialog="mergeDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
      />
    </ContextMenuContent>
  </ContextMenu>

  <!-- Dialogs rendered outside menu to survive menu close -->
  <EntityDeleteFormDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    entity-type="tag"
    :entity-id="props.tagId"
  />

  <TagInfoFormDialog
    v-if="editDialogOpen"
    v-model:open="editDialogOpen"
    :tag-id="props.tagId"
  />

  <EntityMergeDialog
    v-if="mergeDialogOpen"
    v-model:open="mergeDialogOpen"
    entity-type="tag"
    :target-id="props.tagId"
  />
</template>
