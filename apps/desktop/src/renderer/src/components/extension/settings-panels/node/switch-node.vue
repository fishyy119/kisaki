<script setup lang="ts">
import { computed } from 'vue'
import { Switch } from '@renderer/components/ui/switch'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelSwitchNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelSwitchNode
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
  <Switch
    v-model="modelValue"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
  />
</template>
