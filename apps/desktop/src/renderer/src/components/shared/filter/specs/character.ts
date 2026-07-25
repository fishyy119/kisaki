import { computed, type ComputedRef } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { FilterUiSpec } from './types'
import { BLOOD_TYPE_OPTIONS, CUP_SIZE_OPTIONS, getGenderOptions } from './shared-options'

export const characterFilterUiSpec: ComputedRef<FilterUiSpec> = computed(() => {
  const m = messages.value

  return {
    entityType: 'character',
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
        key: 'bloodType',
        label: m.library.fields.bloodType,
        category: 'enum',
        control: 'select',
        options: [...BLOOD_TYPE_OPTIONS]
      },
      {
        key: 'cup',
        label: m.library.fields.cup,
        category: 'enum',
        control: 'select',
        options: [...CUP_SIZE_OPTIONS]
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
        key: 'age',
        label: m.library.fields.age,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 999
      },
      {
        key: 'height',
        label: m.library.fields.height,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 300,
        placeholder: 'cm'
      },
      {
        key: 'weight',
        label: m.library.fields.weight,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 500,
        placeholder: 'kg'
      },
      {
        key: 'bust',
        label: m.library.fields.bust,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 300,
        placeholder: 'cm'
      },
      {
        key: 'waist',
        label: m.library.fields.waist,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 300,
        placeholder: 'cm'
      },
      {
        key: 'hips',
        label: m.library.fields.hips,
        category: 'numeric',
        control: 'numberRange',
        min: 0,
        max: 300,
        placeholder: 'cm'
      },

      {
        key: 'birthDate',
        label: m.library.fields.birthDate,
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
        key: 'persons',
        label: m.library.fields.relatedPersons,
        category: 'relation',
        control: 'relation',
        targetEntity: 'person',
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
      { key: 'age', label: m.library.fields.age },
      { key: 'height', label: m.library.fields.height },
      { key: 'birthDate', label: m.library.fields.birthDate }
    ]
  }
})
