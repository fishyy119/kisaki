<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@renderer/components/ui/input'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelTextInputNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelTextInputNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const modelValue = computed({
  get: () => {
    const value = props.state.draft.values[props.node.id]
    return typeof value === 'string' ? value : ''
  },
  set: (value: string | number) => {
    props.controller.updateValue(props.state, props.node.id, String(value))
  }
})

function commit(): void {
  void props.controller.invokeNode({
    surface: props.state,
    fieldId: props.fieldId,
    node: props.node,
    value: modelValue.value
  })
}
</script>

<template>
  <Input
    v-model="modelValue"
    class="w-full"
    :type="props.node.inputMode === 'password' ? 'password' : (props.node.inputMode ?? 'text')"
    :placeholder="props.node.placeholder"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
    @blur="commit"
  />
</template>
