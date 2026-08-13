<!--
  EntityBatchDeleteFormDialog
  Delete confirmation dialog for multiple entities of one type.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import type { AllEntityType } from '@shared/common'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils/entity-delete'
import { useI18n } from '@renderer/composables/use-i18n'
import DeleteRelatedOptions from './delete-related-options.vue'

const { m } = useI18n()

interface Props {
  entityType: AllEntityType
  entityIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [entityIds: string[]]
}>()

const entityIds = computed(() => props.entityIds)

const {
  data,
  isLoading,
  count,
  entityName,
  previewNames,
  relatedOptions,
  selectedRelatedTypes,
  deleteSelectedEntities
} = useEntityDelete({
  entityType: () => props.entityType,
  entityIds,
  open
})

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))
    emit('deleted', props.entityIds)
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
    :entity-label="m.library.entities[props.entityType]"
    :entity-name="entityName"
    :loading="isLoading || !data"
    @confirm="handleConfirm"
  >
    <div
      v-if="previewNames.length > 0"
      class="text-xs text-muted-foreground space-y-1"
    >
      <div
        v-for="(name, index) in previewNames"
        :key="index"
        class="truncate"
      >
        {{ name }}
      </div>
      <div
        v-if="count > previewNames.length"
        class="opacity-70"
      >
        {{ m.library.forms.andMoreCount({ count }) }}
      </div>
    </div>

    <DeleteRelatedOptions
      v-model:selected-types="selectedRelatedTypes"
      :options="relatedOptions"
    />
  </DeleteConfirmDialog>
</template>
