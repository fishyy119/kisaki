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
import type { CommandListItem } from '@shared/command'

interface Props {
  commands: CommandListItem[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索命令...',
  emptyText: '选择命令...',
  disabled: false
})

const modelValue = defineModel<string>({ default: '' })

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
        subText: '命令当前不可用'
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
    :placeholder="props.placeholder"
    :empty-text="props.emptyText"
    :disabled="props.disabled"
    :class="props.class"
    :max-height="280"
  />
</template>
