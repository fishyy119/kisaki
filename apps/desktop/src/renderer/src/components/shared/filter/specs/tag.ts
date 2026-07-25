import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'

export const tagFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'tag',
    fields: [
      { key: 'isNsfw', label: 'NSFW', category: 'toggle', control: 'boolean' },
      {
        key: 'createdAt',
        label: m.library.fields.addedDate,
        category: 'date',
        control: 'dateRange'
      }
    ],
    sortOptions: [
      { key: 'name', label: m.library.fields.name },
      { key: 'createdAt', label: m.library.fields.addedDate }
    ]
  }
})
