<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/utils'
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
const horizontal = computed(() => props.node.orientation === 'horizontal')
const groupClass = computed(() =>
  cn(
    horizontal.value
      ? 'flex flex-row flex-wrap items-center gap-x-4 gap-y-2'
      : 'gap-3'
  )
)
const optionClass = computed(() =>
  cn('flex gap-2', horizontal.value ? 'items-center' : 'items-start')
)
const itemClass = computed(() => cn(!horizontal.value && 'mt-0.5'))
const labelClass = computed(() =>
  cn(
    'min-w-0 cursor-pointer text-sm leading-normal font-normal',
    horizontal.value ? 'whitespace-nowrap' : 'flex-1 flex-col items-start gap-1'
  )
)

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
    :class="groupClass"
    @update:model-value="updateValue"
  >
    <div
      v-for="option in props.node.options"
      :key="option.value"
      :class="optionClass"
    >
      <RadioGroupItem
        :id="`${props.node.id}-${option.value}`"
        :value="option.value"
        :disabled="option.disabled"
        :class="itemClass"
      />
      <Label
        :for="`${props.node.id}-${option.value}`"
        :class="labelClass"
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
