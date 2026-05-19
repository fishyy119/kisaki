<script setup lang="ts">
import { computed } from 'vue'
import { Checkbox } from '@renderer/components/ui/checkbox'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelMultiSelectNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelMultiSelectNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const values = computed(() => {
  const current = props.state.draft.values[props.node.id]
  return Array.isArray(current)
    ? current.filter((item): item is string => typeof item === 'string')
    : []
})

function toggle(value: string, checked: boolean): void {
  const nextValues = checked
    ? [...new Set([...values.value, value])]
    : values.value.filter((item) => item !== value)
  props.controller.updateValue(props.state, props.node.id, nextValues)
  void props.controller.invokeNode({
    surface: props.state,
    fieldId: props.fieldId,
    node: props.node,
    value: nextValues
  })
}
</script>

<template>
  <div class="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
    <label
      v-for="option in props.node.options"
      :key="option.value"
      class="flex items-center gap-2 text-sm"
    >
      <Checkbox
        :model-value="values.includes(option.value)"
        :disabled="
          props.fieldDisabled ||
          props.node.disabled ||
          option.disabled ||
          props.controller.isCallbackBusy(props.node.callbackId)
        "
        @update:model-value="toggle(option.value, $event === true)"
      />
      <span>{{ option.label }}</span>
    </label>
  </div>
</template>
