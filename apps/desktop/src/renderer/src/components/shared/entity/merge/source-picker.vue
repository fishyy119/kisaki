<!--
  MergeSourcePicker
  Picks the duplicate row to fold into the merge target. The entity's own select
  comes from the shared select registry, so every entity type is pickable.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { AllEntityType } from '@shared/entity-types'
import { useI18n } from '@renderer/composables'
import { ENTITY_SELECT_SPECS } from '../select-specs'

interface Props {
  entityType: AllEntityType
  targetId: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const sourceId = defineModel<string>({ required: true })
const { m } = useI18n()

const spec = computed(() => ENTITY_SELECT_SPECS[props.entityType])

const emptyText = computed(() =>
  m.value.merge.selectDuplicate({ label: m.value.library.entities[props.entityType] })
)

const excludeIds = computed(() => [props.targetId])

/** A cleared collection select reports null; the dialog reads "" as unpicked. */
function handleSelect(value: string | null): void {
  sourceId.value = value ?? ''
}
</script>

<template>
  <component
    :is="spec.component()"
    class="w-full"
    :model-value="sourceId"
    :empty-text="emptyText"
    :exclude-ids="excludeIds"
    :disabled="props.disabled"
    v-bind="spec.pickerProps"
    @update:model-value="handleSelect"
  />
</template>
