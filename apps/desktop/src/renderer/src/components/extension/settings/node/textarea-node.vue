<script setup lang="ts">
import { computed } from 'vue'
import { Textarea } from '@renderer/components/ui/textarea'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsTextareaNode,
  ExtensionSettingsSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsTextareaNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsSurfaceState<ExtensionSettingsSurface>
  controller: ExtensionSettingsSessionController
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
  <Textarea
    v-model="modelValue"
    class="w-full"
    :placeholder="props.node.placeholder"
    :rows="props.node.rows ?? 3"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
    @blur="commit"
  />
</template>
