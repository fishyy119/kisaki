<!--
  AnimeBatchContextMenu
  Context menu for batch operations on multiple anime entries.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent
} from '@renderer/components/ui/context-menu'
import AnimeBatchMenuItems from './batch-menu-items.vue'
import { AnimeBatchDeleteFormDialog, AnimeBatchMetadataUpdateFormDialog } from '../forms'

interface Props {
  animeIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleted: [animeIds: string[]]
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
      <AnimeBatchMenuItems
        :anime-ids="props.animeIds"
        :enabled="menuOpen"
        @open-metadata-update-dialog="metadataUpdateDialogOpen = true"
        @open-delete-dialog="deleteDialogOpen = true"
      />
    </ContextMenuContent>
  </ContextMenu>

  <AnimeBatchDeleteFormDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :anime-ids="props.animeIds"
    @deleted="emit('deleted', $event)"
  />

  <AnimeBatchMetadataUpdateFormDialog
    v-if="metadataUpdateDialogOpen"
    v-model:open="metadataUpdateDialogOpen"
    :anime-ids="props.animeIds"
  />
</template>
