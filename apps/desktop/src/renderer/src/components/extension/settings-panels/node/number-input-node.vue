<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input } from '@renderer/components/ui/input'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelNumberInputNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelNumberInputNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const modelValue = ref('')
const focused = ref(false)

watch(
  () => props.state.draft.values[props.node.id],
  () => {
    if (!focused.value) {
      syncModelFromDraft()
    }
  },
  { immediate: true }
)

function updateModelValue(value: string | number): void {
  modelValue.value = String(value)
  const numericValue = parseModelValue()
  if (numericValue !== null) {
    props.controller.updateValue(props.state, props.node.id, numericValue)
    void props.controller.invokeNode({
      surface: props.state,
      fieldId: props.fieldId,
      node: props.node,
      value: numericValue
    })
  }
}

function blur(): void {
  focused.value = false
  const value = parseModelValue()
  if (value === null) {
    syncModelFromDraft()
    return
  }

  props.controller.updateValue(props.state, props.node.id, value)
}

function parseModelValue(): number | null {
  const text = modelValue.value.trim()
  if (!text) {
    return null
  }

  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function syncModelFromDraft(): void {
  const value = props.state.draft.values[props.node.id]
  modelValue.value = typeof value === 'number' ? String(value) : ''
}

function focus(): void {
  focused.value = true
}
</script>

<template>
  <Input
    :model-value="modelValue"
    class="w-40 max-w-full"
    type="number"
    :placeholder="props.node.placeholder"
    :min="props.node.min"
    :max="props.node.max"
    :step="props.node.step"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
    @update:model-value="updateModelValue"
    @focus="focus"
    @blur="blur"
  />
</template>
