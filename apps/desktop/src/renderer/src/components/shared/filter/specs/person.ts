import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'
import { getGenderOptions } from './shared-options'

export const personFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'person',
    fields: [
      { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
      { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

      { key: 'gender', label: m.library.fields.gender, kind: 'enum', options: getGenderOptions() },

      { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100 },

      { key: 'birthDate', label: m.library.fields.birthDate, kind: 'date' },
      { key: 'deathDate', label: m.library.fields.deathDate, kind: 'date' },
      { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' },

      { key: 'games', label: m.library.fields.relatedGames, kind: 'relation' },
      { key: 'characters', label: m.library.fields.relatedCharacters, kind: 'relation' },
      { key: 'tags', label: m.library.fields.tags, kind: 'relation' },
      { key: 'collections', label: m.library.fields.collections, kind: 'relation' }
    ],
    sortOptions: [
      { key: 'name', label: m.library.fields.name },
      { key: 'sortName', label: m.library.fields.sortName },
      { key: 'originalName', label: m.library.fields.originalName },
      { key: 'createdAt', label: m.library.fields.addedDate },
      { key: 'score', label: m.library.fields.score },
      { key: 'birthDate', label: m.library.fields.birthDate }
    ]
  }
})
