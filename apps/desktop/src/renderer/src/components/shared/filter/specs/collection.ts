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
        // The user's own arrangement is the collection list's primary order,
        // like a membership order: first, and without a direction.
        { key: 'order', label: m.library.fields.order, directionFixed: true },
        { key: 'name', label: m.library.fields.name },
        { key: 'createdAt', label: m.library.fields.addedDate }
      ]
    }
  })
