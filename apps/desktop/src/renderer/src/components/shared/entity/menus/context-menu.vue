<!--
  EntityContextMenu
  Context menu shell for entity items (right-click menu). Dialog states live
  in the shared dialog assembly so they survive menu close.
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
import type { MenuComponents } from '@renderer/types'
import type { TableEntityType } from '../entity-tables'
import EntityMenuItems from './menu-items.vue'
import EntityMenuDialogs from './menu-dialogs.vue'

interface Props {
  entityType: TableEntityType
  entityId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [entityId: string]
}>()

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

const dialogs = ref<InstanceType<typeof EntityMenuDialogs>>()
</script>

<template>
  <ContextMenu v-model:open="menuOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <EntityMenuItems
        :entity-type="props.entityType"
        :entity-id="props.entityId"
        :components="contextMenuComponents"
        :enabled="menuOpen"
        @open-score-dialog="dialogs?.open('score')"
        @open-assets-dialog="dialogs?.open('assets')"
        @open-metadata-update-dialog="dialogs?.open('metadataUpdate')"
        @open-external-ids-dialog="dialogs?.open('externalIds')"
        @open-merge-dialog="dialogs?.open('merge')"
        @open-delete-dialog="dialogs?.open('delete')"
        @open-new-collection-dialog="dialogs?.open('newCollection')"
        @open-extra-dialog="(name) => dialogs?.open(name)"
      />
    </ContextMenuContent>
  </ContextMenu>

  <!-- Dialogs rendered outside menu to survive menu close -->
  <EntityMenuDialogs
    ref="dialogs"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    @deleted="emit('deleted', $event)"
  />
</template>
