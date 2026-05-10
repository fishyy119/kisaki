<script setup lang="ts">
import { computed } from 'vue'
import { Checkbox } from '@renderer/components/ui/checkbox'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelCheckboxNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelCheckboxNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const modelValue = computed({
  get: () => props.state.draft.values[props.node.id] === true,
  set: (value: boolean) => {
    props.controller.updateValue(props.state, props.node.id, value)
    void props.controller.invokeNode({
      surface: props.state,
      fieldId: props.fieldId,
      node: props.node,
      value
    })
  }
})
</script>

<template>
  <Checkbox
    v-model="modelValue"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
  />
</template>
