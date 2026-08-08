import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { tagFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'

export const tagFilterUiSpec: ComputedRef<FilterUiSpec<typeof tagFilterQuerySpec>> = computed(
  () => {
    const m = messages.value

    return {
      entityType: 'tag',
      fields: [
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },
        { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' }
      ],
      sortOptions: [
        { key: 'name', label: m.library.fields.name },
        { key: 'createdAt', label: m.library.fields.addedDate }
      ]
    }
  }
)
