import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'

export const collectionFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'collection',
    fields: [
      { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },
      { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' }
    ],
    sortOptions: [
      { key: 'name', label: m.library.fields.name },
      { key: 'order', label: m.library.fields.order },
      { key: 'createdAt', label: m.library.fields.addedDate }
    ]
  }
})
