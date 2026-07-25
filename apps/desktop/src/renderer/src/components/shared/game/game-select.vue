<!--
  GameSelect
  Game select with built-in data fetching.
  Supports both single and multiple selection modes.
  Uses virtual scrolling for performance.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@renderer/stores'
import { useAsyncData, useEvent, useI18n } from '@renderer/composables'
import { db } from '@renderer/core/db'
import { getAttachmentUrl } from '@renderer/utils/attachment'
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
  /** Game IDs to exclude from the list */
  excludeIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  emptyText: undefined,
  multiple: false,
  excludeIds: () => []
})

const { m } = useI18n()

const placeholderText = computed(
  () =>
    props.placeholder ??
    m.value.library.select.searchPlaceholder({ label: m.value.library.entities.game })
)
const emptyTextValue = computed(
  () =>
    props.emptyText ??
    m.value.library.select.selectPlaceholder({ label: m.value.library.entities.game })
)

/** For single selection mode */
const modelValue = defineModel<string>({ default: '' })
/** For multiple selection mode */
const selectedIdsModel = defineModel<string[]>('selectedIds', { default: () => [] })

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const { data: allGames, refetch } = useAsyncData(
  () =>
    db.query.games.findMany({
      columns: { id: true, name: true, originalName: true, coverFile: true },
      ...(showNsfw.value ? {} : { where: (g, { eq }) => eq(g.isNsfw, false) })
    }),
  { watch: [showNsfw] }
)

useEvent('db.inserted', ({ table }) => {
  if (table === 'games') refetch()
})
useEvent('db.updated', ({ table }) => {
  if (table === 'games') refetch()
})
useEvent('db.deleted', ({ table }) => {
  if (table === 'games') refetch()
})

const gameEntities = computed(() =>
  (allGames.value ?? [])
    .filter((game) => !props.excludeIds.includes(game.id))
    .map((game) => ({
      id: game.id,
      name: game.name,
      subText: game.originalName || undefined,
      imageUrl: game.coverFile
        ? getAttachmentUrl('games', game.id, game.coverFile, {
            width: 100,
            height: 100
          })
        : null
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
    :entities="gameEntities"
    :placeholder="placeholderText"
    :empty-text="emptyTextValue"
    :multiple="props.multiple"
    :class="props.class"
    :disabled="props.disabled"
  />
</template>
