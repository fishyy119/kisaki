import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { companyFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'

export const companyFilterUiSpec: ComputedRef<FilterUiSpec<typeof companyFilterQuerySpec>> =
  computed(() => {
    const m = messages.value

    return {
      entityType: 'company',
      fields: [
        { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

        { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100 },

        { key: 'foundedDate', label: m.library.fields.foundedDate, kind: 'date' },
        { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' },

        { key: 'games', label: m.library.fields.relatedGames, kind: 'relation' },
        { key: 'tags', label: m.library.fields.tags, kind: 'relation' },
        { key: 'collections', label: m.library.fields.collections, kind: 'relation' }
      ],
      sortOptions: [
        { key: 'name', label: m.library.fields.name },
        { key: 'sortName', label: m.library.fields.sortName },
        { key: 'originalName', label: m.library.fields.originalName },
        { key: 'createdAt', label: m.library.fields.addedDate },
        { key: 'score', label: m.library.fields.score },
        { key: 'foundedDate', label: m.library.fields.foundedDate }
      ]
    }
  })
