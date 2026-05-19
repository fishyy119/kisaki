<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelStringListNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelStringListNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const values = computed(() => {
  const current = props.state.draft.values[props.node.id]
  return Array.isArray(current)
    ? current.filter((item): item is string => typeof item === 'string')
    : []
})
const disabled = computed(
  () =>
    props.fieldDisabled ||
    props.node.disabled ||
    props.controller.isCallbackBusy(props.node.callbackId)
)

function updateItem(index: number, value: string): void {
  const nextValues = [...values.value]
  nextValues[index] = value
  applyValues(nextValues)
}

function addItem(): void {
  applyValues([...values.value, ''])
}

function removeItem(index: number): void {
  applyValues(values.value.filter((_, itemIndex) => itemIndex !== index))
}

function applyValues(nextValues: string[]): void {
  props.controller.updateValue(props.state, props.node.id, nextValues)
  void props.controller.invokeNode({
    surface: props.state,
    fieldId: props.fieldId,
    node: props.node,
    value: nextValues
  })
}
</script>

<template>
  <div class="flex w-full flex-col gap-2">
    <div
      v-for="(value, index) in values"
      :key="index"
      class="flex items-center gap-2"
    >
      <Input
        :model-value="value"
        class="min-w-0 flex-1"
        :placeholder="props.node.itemPlaceholder"
        :disabled="disabled"
        @update:model-value="updateItem(index, String($event))"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        :disabled="disabled"
        @click="removeItem(index)"
      >
        <span class="icon-[mdi--close] size-4" />
      </Button>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      class="w-fit"
      :disabled="disabled"
      @click="addItem"
    >
      {{ props.node.addPlaceholder ?? '添加' }}
    </Button>
  </div>
</template>
