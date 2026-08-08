import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import { characterFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'
import { BLOOD_TYPE_OPTIONS, CUP_SIZE_OPTIONS, getGenderOptions } from './shared-options'

export const characterFilterUiSpec: ComputedRef<FilterUiSpec<typeof characterFilterQuerySpec>> =
  computed(() => {
    const m = messages.value

    return {
      entityType: 'character',
      fields: [
        { key: 'isFavorite', label: m.filter.favorite, kind: 'boolean' },
        { key: 'isNsfw', label: 'NSFW', kind: 'boolean' },

        {
          key: 'gender',
          label: m.library.fields.gender,
          kind: 'enum',
          options: getGenderOptions()
        },
        {
          key: 'bloodType',
          label: m.library.fields.bloodType,
          kind: 'enum',
          options: [...BLOOD_TYPE_OPTIONS]
        },
        { key: 'cup', label: m.library.fields.cup, kind: 'enum', options: [...CUP_SIZE_OPTIONS] },

        { key: 'score', label: m.library.fields.score, kind: 'number', min: 0, max: 100 },
        { key: 'age', label: m.library.fields.age, kind: 'number', min: 0, max: 999 },
        {
          key: 'height',
          label: m.library.fields.height,
          kind: 'number',
          min: 0,
          max: 300,
          unit: 'cm'
        },
        {
          key: 'weight',
          label: m.library.fields.weight,
          kind: 'number',
          min: 0,
          max: 500,
          unit: 'kg'
        },
        {
          key: 'bust',
          label: m.library.fields.bust,
          kind: 'number',
          min: 0,
          max: 300,
          unit: 'cm'
        },
        {
          key: 'waist',
          label: m.library.fields.waist,
          kind: 'number',
          min: 0,
          max: 300,
          unit: 'cm'
        },
        {
          key: 'hips',
          label: m.library.fields.hips,
          kind: 'number',
          min: 0,
          max: 300,
          unit: 'cm'
        },

        { key: 'birthDate', label: m.library.fields.birthDate, kind: 'date' },
        { key: 'createdAt', label: m.library.fields.addedDate, kind: 'date' },

        { key: 'games', label: m.library.fields.relatedGames, kind: 'relation' },
        { key: 'persons', label: m.library.fields.relatedPersons, kind: 'relation' },
        { key: 'tags', label: m.library.fields.tags, kind: 'relation' },
        { key: 'collections', label: m.library.fields.collections, kind: 'relation' }
      ],
      sortOptions: [
        { key: 'name', label: m.library.fields.name },
        { key: 'sortName', label: m.library.fields.sortName },
        { key: 'originalName', label: m.library.fields.originalName },
        { key: 'createdAt', label: m.library.fields.addedDate },
        { key: 'score', label: m.library.fields.score },
        { key: 'age', label: m.library.fields.age },
        { key: 'height', label: m.library.fields.height },
        { key: 'birthDate', label: m.library.fields.birthDate }
      ]
    }
  })
