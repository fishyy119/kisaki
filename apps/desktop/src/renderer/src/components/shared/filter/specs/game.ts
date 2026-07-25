import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'
import { getGameStatusOptions } from './shared-options'

export const gameFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'game',
    fields: [
      { key: 'isFavorite', label: m.filter.favorite, category: 'toggle', control: 'boolean' },
      { key: 'isNsfw', label: 'NSFW', category: 'toggle', control: 'boolean' },

      {
        key: 'status',
        label: m.library.fields.status,
        category: 'enum',
        control: 'multiSelect',
        options: getGameStatusOptions()
      },

      {
        key: 'score',
        label: m.library.fields.score,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 100,
        step: 1
      },
      {
        key: 'totalDuration',
        label: m.library.fields.playDuration,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        placeholder: m.filter.secondsUnit
      },

      {
        key: 'releaseDate',
        label: m.library.fields.releaseDate,
        category: 'date',
        control: 'dateRange'
      },
      {
        key: 'lastActiveAt',
        label: m.library.fields.lastActiveAt,
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
      },
      {
        key: 'persons',
        label: m.library.fields.relatedPersons,
        category: 'relation',
        control: 'relation',
        targetEntity: 'person',
        multiple: true
      },
      {
        key: 'companies',
        label: m.library.fields.relatedCompanies,
        category: 'relation',
        control: 'relation',
        targetEntity: 'company',
        multiple: true
      },
      {
        key: 'characters',
        label: m.library.fields.relatedCharacters,
        category: 'relation',
        control: 'relation',
        targetEntity: 'character',
        multiple: true
      }
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
})
