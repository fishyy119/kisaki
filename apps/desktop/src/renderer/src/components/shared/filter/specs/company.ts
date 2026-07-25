import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'

export const companyFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'company',
    fields: [
      { key: 'isFavorite', label: m.filter.favorite, category: 'toggle', control: 'boolean' },
      { key: 'isNsfw', label: 'NSFW', category: 'toggle', control: 'boolean' },

      {
        key: 'score',
        label: m.library.fields.score,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 100
      },

      {
        key: 'foundedDate',
        label: m.library.fields.foundedDate,
        category: 'date',
        control: 'dateRange'
      },
      {
        key: 'createdAt',
        label: m.library.fields.addedDate,
        category: 'date',
        control: 'dateRange'
      },

      {
        key: 'games',
        label: m.library.fields.relatedGames,
        category: 'relation',
        control: 'relation',
        targetEntity: 'game',
        multiple: true
      },
      {
        key: 'tags',
        label: m.library.fields.tags,
        category: 'relation',
        control: 'relation',
        targetEntity: 'tag',
        multiple: true
      },
      {
        key: 'collections',
        label: m.library.fields.collections,
        category: 'relation',
        control: 'relation',
        targetEntity: 'collection',
        multiple: true
      }
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
