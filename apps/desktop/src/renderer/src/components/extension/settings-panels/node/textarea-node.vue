<script setup lang="ts">
import { computed } from 'vue'
import { Textarea } from '@renderer/components/ui/textarea'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelTextareaNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelTextareaNode
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
