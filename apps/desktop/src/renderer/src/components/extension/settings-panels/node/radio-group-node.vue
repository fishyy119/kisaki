<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { Label } from '@renderer/components/ui/label'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelRadioGroupNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelRadioGroupNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const value = computed(() => {
  const current = props.state.draft.values[props.node.id]
  return typeof current === 'string' ? current : props.node.initialValue
})

function updateValue(nextValue: unknown): void {
  const normalized = typeof nextValue === 'string' ? nextValue : props.node.initialValue
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
  <RadioGroup
    :model-value="value"
    :disabled="
      props.fieldDisabled ||
      props.node.disabled ||
      props.controller.isCallbackBusy(props.node.callbackId)
    "
    class="gap-3"
    @update:model-value="updateValue"
  >
    <div
      v-for="option in props.node.options"
      :key="option.value"
      class="flex items-start gap-2"
    >
      <RadioGroupItem
        :id="`${props.node.id}-${option.value}`"
        :value="option.value"
        :disabled="option.disabled"
        class="mt-0.5"
      />
      <Label
        :for="`${props.node.id}-${option.value}`"
        class="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-sm leading-normal font-normal"
      >
        <span>{{ option.label }}</span>
        <span
          v-if="option.description"
          class="text-xs text-muted-foreground"
        >
          {{ option.description }}
        </span>
      </Label>
    </div>
  </RadioGroup>
</template>
