<!--
  AnimeContextMenu
  Context menu for anime items (right-click menu).
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
import {
  AnimeDeleteFormDialog,
  AnimeScoreFormDialog,
  AnimeMetadataUpdateFormDialog
} from '../forms'
import { CollectionInfoFormDialog } from '@renderer/components/shared/collection'
import { EntityMergeDialog } from '@renderer/components/shared/entity-merge'
import AnimeMenuItems from './menu-items.vue'
import type { MenuComponents } from '@renderer/types'

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [animeId: string]
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

// Dialog states managed by parent to survive menu close
const deleteDialogOpen = ref(false)
const scoreDialogOpen = ref(false)
const collectionDialogOpen = ref(false)
const metadataUpdateDialogOpen = ref(false)
const mergeDialogOpen = ref(false)
</script>

<template>
  <ContextMenu v-model:open="menuOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <AnimeMenuItems
        :anime-id="props.animeId"
        :components="contextMenuComponents"
        :enabled="menuOpen"
        @open-score-dialog="scoreDialogOpen = true"
        @open-metadata-update-dialog="metadataUpdateDialogOpen = true"
        @open-merge-dialog="mergeDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
        @open-new-collection-dialog="collectionDialogOpen = true"
      />
    </ContextMenuContent>
  </ContextMenu>

  <!-- Dialogs rendered outside menu to survive menu close -->
  <AnimeDeleteFormDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :anime-id="props.animeId"
    @deleted="emit('deleted', $event)"
  />

  <AnimeScoreFormDialog
    v-if="scoreDialogOpen"
    v-model:open="scoreDialogOpen"
    :anime-id="props.animeId"
  />

  <AnimeMetadataUpdateFormDialog
    v-if="metadataUpdateDialogOpen"
    v-model:open="metadataUpdateDialogOpen"
    :anime-id="props.animeId"
  />

  <EntityMergeDialog
    v-if="mergeDialogOpen"
    v-model:open="mergeDialogOpen"
    entity-type="anime"
    :target-id="props.animeId"
  />

  <CollectionInfoFormDialog
    v-if="collectionDialogOpen"
    v-model:open="collectionDialogOpen"
    :entity-to-add="{ type: 'anime', id: props.animeId }"
  />
</template>
