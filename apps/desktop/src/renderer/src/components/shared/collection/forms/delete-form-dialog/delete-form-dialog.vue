<!--
  CollectionDeleteDialog

  Delete confirmation dialog for collections.
  Uses shared DeleteConfirmDialog component.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils'

interface Props {
  collectionId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [collectionId: string]
}>()

const entityIds = computed(() => (props.collectionId ? [props.collectionId] : []))

const {
  data,
  isLoading,
  firstName,
  relatedOptions,
  selectedRelatedTypes,
  deleteSelectedEntities
} = useEntityDelete({
  entityType: 'collection',
  entityIds,
  open
})

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.collectionId)
  } catch (error) {
    notify.error(`删除失败: ${(error as Error).message}`)
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    entity-label="合集"
    :entity-name="firstName"
    :loading="isLoading || !data"
    @confirm="handleConfirm"
  >
    <DeleteRelatedOptions
      v-model:selected-types="selectedRelatedTypes"
      :options="relatedOptions"
    />
  </DeleteConfirmDialog>
</template>
