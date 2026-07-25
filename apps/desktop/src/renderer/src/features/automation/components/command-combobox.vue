<!--
Command Combobox adapts command descriptors to the shared virtualized combobox.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  VirtualizedCombobox,
  type VirtualizedComboboxEntity
} from '@renderer/components/ui/virtualized-combobox'
import { useI18n } from '@renderer/composables/use-i18n'
import type { CommandListItem } from '@shared/command'

interface Props {
  commands: CommandListItem[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  emptyText: undefined,
  disabled: false
})

const modelValue = defineModel<string>({ default: '' })

const { m } = useI18n()

const placeholderText = computed(
  () => props.placeholder ?? m.value.automation.combobox.searchPlaceholder
)
const emptyTextValue = computed(
  () => props.emptyText ?? m.value.automation.combobox.selectPlaceholder
)

const commandEntities = computed<VirtualizedComboboxEntity[]>(() => {
  const entities = props.commands.map((command) => ({
    id: command.id,
    name: command.title,
    subText: [command.id, command.description].filter(Boolean).join(' · ') || undefined
  }))

  if (modelValue.value && !entities.some((entity) => entity.id === modelValue.value)) {
    return [
      {
        id: modelValue.value,
        name: modelValue.value,
        subText: m.value.automation.combobox.unavailable
      },
      ...entities
    ]
  }

  return entities
})

const selectedIds = computed({
  get: () => (modelValue.value ? [modelValue.value] : []),
  set: (ids: string[]) => {
    modelValue.value = ids[0] || ''
  }
})
</script>

<template>
  <VirtualizedCombobox
    v-model:selected-ids="selectedIds"
    :entities="commandEntities"
    :placeholder="placeholderText"
    :empty-text="emptyTextValue"
    :disabled="props.disabled"
    :class="props.class"
    :max-height="280"
  />
</template>
