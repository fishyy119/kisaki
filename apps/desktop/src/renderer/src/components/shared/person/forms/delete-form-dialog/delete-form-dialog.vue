<!--
  PersonDeleteFormDialog
  Delete confirmation dialog for persons.
  Uses shared DeleteConfirmDialog component.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils/entity-delete'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [personId: string]
}>()

const entityIds = computed(() => (props.personId ? [props.personId] : []))

const { data, isLoading, firstName, relatedOptions, selectedRelatedTypes, deleteSelectedEntities } =
  useEntityDelete({
    entityType: 'person',
    entityIds,
    open
  })

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.personId)
  } catch (error) {
    notify.error(
      m.value.library.feedback.deleteFailedWithReason({ message: (error as Error).message })
    )
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    :entity-label="m.library.entities.person"
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
