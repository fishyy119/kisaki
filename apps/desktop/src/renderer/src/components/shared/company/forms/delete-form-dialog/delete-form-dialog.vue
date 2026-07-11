<!--
  CompanyDeleteFormDialog
  Delete confirmation dialog for companies.
  Uses DeleteConfirmDialog component.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils/entity-delete'

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [companyId: string]
}>()

const entityIds = computed(() => (props.companyId ? [props.companyId] : []))

const { data, isLoading, firstName, relatedOptions, selectedRelatedTypes, deleteSelectedEntities } =
  useEntityDelete({
    entityType: 'company',
    entityIds,
    open
  })

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.companyId)
  } catch (error) {
    notify.error(`删除失败: ${(error as Error).message}`)
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    entity-label="公司"
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
