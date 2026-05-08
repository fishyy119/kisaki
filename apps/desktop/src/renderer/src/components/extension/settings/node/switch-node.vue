<script setup lang="ts">
import { computed } from 'vue'
import { Switch } from '@renderer/components/ui/switch'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsSwitchNode,
  ExtensionSettingsSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsSwitchNode
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
  <Switch
    v-model="modelValue"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
  />
</template>
