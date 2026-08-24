<!--
  FilterBuilder
  Pure condition list: one outlined ConditionEditor block per condition.
  Query-scoped controls live in the hosting panel/dialog chrome instead:
  match mode (all/any) in the header, add condition in the footer.
-->
<script setup lang="ts">
import type { FilterCondition, FilterState } from '@shared/filter'
import { removeCondition, updateCondition } from '@shared/filter'
import { useI18n } from '@renderer/composables'
import { StateView } from '@renderer/components/ui/state-view'
import ConditionEditor from './condition-editor.vue'
import type { FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
}

const props = defineProps<Props>()
const model = defineModel<FilterState>({ required: true })
const { m } = useI18n()

function handleUpdate(index: number, condition: FilterCondition) {
  model.value = updateCondition(model.value, index, condition)
}

function handleRemove(index: number) {
  model.value = removeCondition(model.value, index)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <StateView
      v-if="model.conditions.length === 0"
      state="empty"
      size="sm"
      :description="m.filter.noConditions"
      class="py-3"
    />
    <ConditionEditor
      v-for="(condition, index) in model.conditions"
      :key="index"
      :model-value="condition"
      :ui-spec="props.uiSpec"
      @update:model-value="(next) => handleUpdate(index, next)"
      @remove="() => handleRemove(index)"
    />
  </div>
</template>
