<!--
  CharacterDeleteFormDialog
  Delete confirmation dialog for characters.
  Uses DeleteConfirmDialog component as per conventions.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils'

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [characterId: string]
}>()

const entityIds = computed(() => (props.characterId ? [props.characterId] : []))

const {
  data,
  isLoading,
  firstName,
  relatedOptions,
  selectedRelatedTypes,
  deleteSelectedEntities
} = useEntityDelete({
  entityType: 'character',
  entityIds,
  open
})

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.characterId)
  } catch (error) {
    notify.error(`删除失败: ${(error as Error).message}`)
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    entity-label="角色"
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
