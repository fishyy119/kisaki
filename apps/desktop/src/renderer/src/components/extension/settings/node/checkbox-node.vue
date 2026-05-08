<script setup lang="ts">
import { computed } from 'vue'
import { Checkbox } from '@renderer/components/ui/checkbox'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsCheckboxNode,
  ExtensionSettingsSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsCheckboxNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsSurfaceState<ExtensionSettingsSurface>
  controller: ExtensionSettingsSessionController
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
