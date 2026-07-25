import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'
import { getGenderOptions } from './shared-options'

export const personFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'person',
    fields: [
      { key: 'isFavorite', label: m.filter.favorite, category: 'toggle', control: 'boolean' },
      { key: 'isNsfw', label: 'NSFW', category: 'toggle', control: 'boolean' },

      {
        key: 'gender',
        label: m.library.fields.gender,
        category: 'enum',
        control: 'select',
        options: getGenderOptions()
      },

      {
        key: 'score',
        label: m.library.fields.score,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 100
      },

      {
        key: 'birthDate',
        label: m.library.fields.birthDate,
        category: 'date',
        control: 'dateRange'
      },
      {
        key: 'deathDate',
        label: m.library.fields.deathDate,
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
        key: 'characters',
        label: m.library.fields.relatedCharacters,
        category: 'relation',
        control: 'relation',
        targetEntity: 'character',
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
      { key: 'birthDate', label: m.library.fields.birthDate }
    ]
  }
})
