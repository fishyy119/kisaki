<!--
  PersonSelect
  Person picker with built-in data fetching, in single or multiple mode.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { useEntitySelectSource, useI18n } from '@renderer/composables'
import { VirtualizedCombobox } from '@renderer/components/ui/virtualized-combobox'

interface Props {
  /** Multiple selection mode */
  multiple?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Text when nothing selected */
  emptyText?: string
  /** Class name for trigger button */
  class?: HTMLAttributes['class']
  /** Whether the select is disabled */
  disabled?: boolean
  /** Person IDs to exclude from the list */
  excludeIds?: string[]
  /** Reflect the current selection in the trigger (see VirtualizedCombobox) */
  showSelectedLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  emptyText: undefined,
  multiple: false,
  excludeIds: () => [],
  showSelectedLabel: true
})

const { m } = useI18n()

const placeholderText = computed(
  () =>
    props.placeholder ??
    m.value.library.select.searchPlaceholder({ label: m.value.library.entities.person })
)
const emptyTextValue = computed(
  () =>
    props.emptyText ??
    m.value.library.select.selectPlaceholder({ label: m.value.library.entities.person })
)

/** For single selection mode */
const modelValue = defineModel<string>({ default: '' })
/** For multiple selection mode */
const selectedIdsModel = defineModel<string[]>('selectedIds', { default: () => [] })

const personEntities = useEntitySelectSource('person', () => props.excludeIds)

// Handle both single and multiple selection modes
const selectedIds = computed({
  get: () => {
    if (props.multiple) {
      return selectedIdsModel.value
    }
    return modelValue.value ? [modelValue.value] : []
  },
  set: (ids: string[]) => {
    if (props.multiple) {
      selectedIdsModel.value = ids
    } else {
      modelValue.value = ids[0] || ''
    }
  }
})
</script>

<template>
  <VirtualizedCombobox
    v-model:selected-ids="selectedIds"
    :entities="personEntities"
    :placeholder="placeholderText"
    :empty-text="emptyTextValue"
    :multiple="props.multiple"
    :class="props.class"
    :disabled="props.disabled"
    :show-selected-label="props.showSelectedLabel"
  />
</template>
