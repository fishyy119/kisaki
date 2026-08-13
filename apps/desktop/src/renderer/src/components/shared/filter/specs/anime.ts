import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { animeFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'
import { getAnimeFormatOptions, getAnimeStatusOptions } from './shared-options'

export const animeFilterUiSpec: ComputedRef<FilterUiSpec<typeof animeFilterQuerySpec>> = computed(
  () => {
    const m = messages.value

    return {
      entityType: 'anime',
      fields: [
        { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

        {
          key: 'status',
          label: m.library.fields.status,
          kind: 'enum',
          options: getAnimeStatusOptions()
        },
        {
          key: 'format',
          label: m.library.fields.format,
          kind: 'enum',
          options: getAnimeFormatOptions()
        },

        { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100, step: 1 },
        {
          key: 'totalDuration',
          label: m.library.fields.watchDuration,
          kind: 'number',
          min: 0,
          unit: m.filter.hoursUnit,
          valueScale: 3600000
        },
        { key: 'totalEpisodes', label: m.library.fields.totalEpisodes, kind: 'number', min: 0 },

        { key: 'releaseDate', label: m.library.fields.releaseDate, kind: 'date' },
        { key: 'lastActiveAt', label: m.library.fields.lastWatchedAt, kind: 'date' },
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
        { key: 'lastActiveAt', label: m.library.fields.lastWatchedAt },
        { key: 'totalDuration', label: m.library.fields.watchDuration },
        { key: 'createdAt', label: m.library.fields.addedDate },
        { key: 'releaseDate', label: m.library.fields.releaseDate },
        { key: 'score', label: m.library.fields.score }
      ]
    }
  }
)
