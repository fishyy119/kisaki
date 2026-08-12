<!--
  AnimeDropdownMenu
  Dropdown menu for anime actions (click menu).
  Use in anime detail page header settings button.
  Dialog states are managed here to prevent unmount issues when menu closes.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@renderer/components/ui/dropdown-menu'
import { Button } from '@renderer/components/ui/button'
import {
  AnimeDeleteFormDialog,
  AnimeExternalIdsFormDialog,
  AnimeFilesConfigFormDialog,
  AnimeMediaFormDialog,
  AnimeMetadataUpdateFormDialog,
  AnimeScoreFormDialog
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

// Dropdown menu components adapter
const dropdownMenuComponents: MenuComponents = {
  Item: DropdownMenuItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Separator: DropdownMenuSeparator,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem
}

// Dialog states managed by parent to survive menu close
const deleteDialogOpen = ref(false)
const scoreDialogOpen = ref(false)
const filesConfigDialogOpen = ref(false)
const mediaDialogOpen = ref(false)
const collectionDialogOpen = ref(false)
const metadataUpdateDialogOpen = ref(false)
const externalIdsDialogOpen = ref(false)
const mergeDialogOpen = ref(false)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          variant="secondary"
          size="icon-sm"
        >
          <Icon
            icon="icon-[mdi--dots-horizontal]"
            class="size-4"
          />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      class="min-w-56"
    >
      <AnimeMenuItems
        :anime-id="props.animeId"
        :components="dropdownMenuComponents"
        @open-score-dialog="scoreDialogOpen = true"
        @open-files-config-dialog="filesConfigDialogOpen = true"
        @open-media-dialog="mediaDialogOpen = true"
        @open-metadata-update-dialog="metadataUpdateDialogOpen = true"
        @open-external-ids-dialog="externalIdsDialogOpen = true"
        @open-merge-dialog="mergeDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
        @open-new-collection-dialog="collectionDialogOpen = true"
      />
    </DropdownMenuContent>
  </DropdownMenu>

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

  <AnimeFilesConfigFormDialog
    v-if="filesConfigDialogOpen"
    v-model:open="filesConfigDialogOpen"
    :anime-id="props.animeId"
  />

  <AnimeMediaFormDialog
    v-if="mediaDialogOpen"
    v-model:open="mediaDialogOpen"
    :anime-id="props.animeId"
  />

  <AnimeMetadataUpdateFormDialog
    v-if="metadataUpdateDialogOpen"
    v-model:open="metadataUpdateDialogOpen"
    :anime-id="props.animeId"
  />

  <AnimeExternalIdsFormDialog
    v-if="externalIdsDialogOpen"
    v-model:open="externalIdsDialogOpen"
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
