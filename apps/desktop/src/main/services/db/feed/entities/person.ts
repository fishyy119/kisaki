import type { EntityProjection } from '../types'

export const personEntityProjection = {
  entity: 'person',
  scoreField: 'score',
  coreFields: {
    name: 'name',
    original_name: 'originalName',
    sort_name: 'sortName',
    description: 'description',
    is_favorite: 'isFavorite',
    is_nsfw: 'isNsfw',
    birth_date: 'birthDate',
    death_date: 'deathDate',
    gender: 'gender',
    external_sites: 'externalSites'
  },
  assetFields: {
    photo_file: 'photoFile'
  }
} satisfies EntityProjection
