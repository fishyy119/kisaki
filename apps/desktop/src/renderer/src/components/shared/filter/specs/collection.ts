import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { collectionFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'

export const collectionFilterUiSpec: ComputedRef<FilterUiSpec<typeof collectionFilterQuerySpec>> =
  computed(() => {
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
