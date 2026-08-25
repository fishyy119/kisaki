import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { novelFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'
import { getNovelFormatOptions, getNovelStatusOptions } from './shared-options'

export const novelFilterUiSpec: ComputedRef<FilterUiSpec<typeof novelFilterQuerySpec>> = computed(
  () => {
    const m = messages.value

    return {
      entityType: 'novel',
      fields: [
        { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

        {
          key: 'status',
          label: m.library.fields.status,
          kind: 'enum',
          options: getNovelStatusOptions()
        },
        {
          key: 'format',
          label: m.library.fields.format,
          kind: 'enum',
          options: getNovelFormatOptions()
        },

        { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100, step: 1 },
        {
          key: 'totalDuration',
          label: m.library.fields.readDuration,
          kind: 'number',
          min: 0,
          unit: m.filter.hoursUnit,
          valueScale: 3600000
        },
        { key: 'totalVolumes', label: m.library.fields.totalVolumes, kind: 'number', min: 0 },

        { key: 'releaseDate', label: m.library.fields.releaseDate, kind: 'date' },
        { key: 'lastActiveAt', label: m.library.fields.lastReadAt, kind: 'date' },
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
        { key: 'lastActiveAt', label: m.library.fields.lastReadAt },
        { key: 'totalDuration', label: m.library.fields.readDuration },
        { key: 'createdAt', label: m.library.fields.addedDate },
        { key: 'releaseDate', label: m.library.fields.releaseDate },
        { key: 'score', label: m.library.fields.score }
      ]
    }
  }
)
