<!--
  PersonSelect
  Person select component with built-in data fetching.
  Supports both single and multiple selection modes.
  Uses virtual scrolling for performance.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@renderer/stores'
import { VirtualizedCombobox } from '@renderer/components/ui/virtualized-combobox'
import { db } from '@renderer/core/db'
import { useAsyncData, useDbChanges, useI18n } from '@renderer/composables'

interface Props {
  /** Multiple selection mode */
  multiple?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Text when nothing selected */
  emptyText?: string
  /** Whether the select is disabled */
  disabled?: boolean
  /** Person IDs to exclude from the list */
  excludeIds?: string[]
  /** Reflect the current selection in the trigger (see VirtualizedCombobox) */
  showSelectedLabel?: boolean
  /** Custom class name */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  placeholder: undefined,
  emptyText: undefined,
  disabled: false,
  excludeIds: () => []
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

/** Currently selected person ID (single mode) */
const modelValue = defineModel<string>({ default: '' })
/** Currently selected person IDs (multiple mode) */
const selectedIdsModel = defineModel<string[]>('selectedIds', { default: () => [] })

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const { data: allPersons, refetch } = useAsyncData(
  () =>
    db.query.persons.findMany({
      columns: { id: true, name: true },
      ...(showNsfw.value ? {} : { where: (p, { eq }) => eq(p.isNsfw, false) })
    }),
  { watch: [showNsfw] }
)

useDbChanges(({ table }) => {
  if (table === 'persons') refetch()
})

const personEntities = computed(() =>
  (allPersons.value || [])
    .filter((person) => !props.excludeIds.includes(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name
    }))
)

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
    :multiple="multiple"
    :class="props.class"
    :disabled="disabled"
    :show-selected-label="props.showSelectedLabel"
  />
</template>
