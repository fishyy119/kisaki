import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { gameFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'
import { getMediaStatusOptions } from './shared-options'

export const gameFilterUiSpec: ComputedRef<FilterUiSpec<typeof gameFilterQuerySpec>> = computed(
  () => {
    const m = messages.value

    return {
      entityType: 'game',
      fields: [
        { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

        {
          key: 'status',
          label: m.library.fields.status,
          kind: 'enum',
          options: getMediaStatusOptions()
        },

        { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100, step: 1 },
        {
          key: 'totalDuration',
          label: m.library.fields.playDuration,
          kind: 'number',
          min: 0,
          unit: m.filter.secondsUnit
        },

        { key: 'releaseDate', label: m.library.fields.releaseDate, kind: 'date' },
        { key: 'lastActiveAt', label: m.library.fields.lastActiveAt, kind: 'date' },
        { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' },

        { key: 'tags', label: m.library.fields.tags, kind: 'relation' },
        { key: 'collections', label: m.library.fields.collections, kind: 'relation' },
        { key: 'persons', label: m.library.fields.relatedPersons, kind: 'relation' },
        { key: 'companies', label: m.library.fields.relatedCompanies, kind: 'relation' },
        { key: 'characters', label: m.library.fields.relatedCharacters, kind: 'relation' }
      ],
      sortOptions: [
        { key: 'name', label: m.library.fields.name },
        { key: 'sortName', label: m.library.fields.sortName },
        { key: 'originalName', label: m.library.fields.originalName },
        { key: 'lastActiveAt', label: m.library.fields.lastActiveAt },
        { key: 'totalDuration', label: m.library.fields.playDuration },
        { key: 'createdAt', label: m.library.fields.addedDate },
        { key: 'releaseDate', label: m.library.fields.releaseDate },
        { key: 'score', label: m.library.fields.score }
      ]
    }
  }
)
