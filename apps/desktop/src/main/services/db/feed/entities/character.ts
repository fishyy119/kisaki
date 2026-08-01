import type { EntityProjection } from '../types'

export const characterEntityProjection = {
  entity: 'character',
  scoreField: 'score',
  coreFields: {
    name: 'name',
    original_name: 'originalName',
    sort_name: 'sortName',
    description: 'description',
    is_favorite: 'isFavorite',
    is_nsfw: 'isNsfw',
    birth_date: 'birthDate',
    gender: 'gender',
    blood_type: 'bloodType',
    height: 'height',
    weight: 'weight',
    bust: 'bust',
    waist: 'waist',
    hips: 'hips',
    cup: 'cup',
    age: 'age',
    related_sites: 'relatedSites'
  },
  assetFields: {
    photo_file: 'photoFile'
  }
} satisfies EntityProjection
