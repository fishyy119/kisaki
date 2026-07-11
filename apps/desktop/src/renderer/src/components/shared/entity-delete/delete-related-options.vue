<!--
DeleteRelatedOptions renders optional direct-related entity delete checkboxes.
Boundary: selecting an option deletes the related entity itself, not just the link.
-->
<script setup lang="ts">
import { useId } from 'vue'
import type { AllEntityType } from '@shared/common'
import type { EntityDeletePreviewOption } from '@shared/entity-delete'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { getEntityDeleteLabel } from '@renderer/utils/entity-delete'

interface Props {
  options: EntityDeletePreviewOption[]
}

const props = defineProps<Props>()

const selectedTypes = defineModel<AllEntityType[]>('selectedTypes', { required: true })

const idBase = useId()

function isSelected(entityType: AllEntityType): boolean {
  return selectedTypes.value.includes(entityType)
}

function updateSelected(entityType: AllEntityType, checked: boolean | 'indeterminate'): void {
  const next = new Set(selectedTypes.value)

  if (checked === true) {
    next.add(entityType)
  } else {
    next.delete(entityType)
  }

  selectedTypes.value = [...next]
}
</script>

<template>
  <div
    v-if="props.options.length > 0"
    class="space-y-3"
  >
    <div class="space-y-2">
      <div
        v-for="option in props.options"
        :key="option.entityType"
        class="flex items-center gap-2"
      >
        <Checkbox
          :id="`${idBase}-${option.entityType}`"
          :model-value="isSelected(option.entityType)"
          @update:model-value="(checked) => updateSelected(option.entityType, checked)"
        />
        <Label
          :for="`${idBase}-${option.entityType}`"
          class="text-sm font-normal cursor-pointer"
        >
          同时删除关联{{ getEntityDeleteLabel(option.entityType) }}（{{ option.count }}）
        </Label>
      </div>
    </div>
  </div>
</template>
