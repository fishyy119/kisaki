<script setup lang="ts">
import { computed } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelSelectNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelSelectNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const value = computed(() => {
  const current = props.state.draft.values[props.node.id]
  return typeof current === 'string' ? current : ''
})
const selectedLabel = computed(
  () =>
    props.node.options.find((option) => option.value === value.value)?.label ??
    props.node.placeholder ??
    value.value
)

function updateValue(nextValue: unknown): void {
  const normalized = typeof nextValue === 'string' ? nextValue : ''
  props.controller.updateValue(props.state, props.node.id, normalized)
  void props.controller.invokeNode({
    surface: props.state,
    fieldId: props.fieldId,
    node: props.node,
    value: normalized
  })
}
</script>

<template>
  <Select
    :model-value="value"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
    @update:model-value="updateValue"
  >
    <SelectTrigger class="w-56 max-w-full">
      <span class="truncate">{{ selectedLabel }}</span>
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in props.node.options"
        :key="option.value"
        :value="option.value"
        :description="option.description"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
