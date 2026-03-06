<!--
  GameBatchDeleteFormDialog
  Delete confirmation dialog for multiple games.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils'

interface Props {
  gameIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [gameIds: string[]]
}>()

const entityIds = computed(() => props.gameIds)

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
  entityType: 'game',
  entityIds,
  open
})

async function handleConfirm() {
  try {
    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))
    emit('deleted', props.gameIds)
  } catch (error) {
    notify.error(`删除失败: ${(error as Error).message}`)
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    entity-label="游戏"
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
        …等 {{ count }} 项
      </div>
    </div>

    <DeleteRelatedOptions
      v-model:selected-types="selectedRelatedTypes"
      :options="relatedOptions"
    />
  </DeleteConfirmDialog>
</template>
