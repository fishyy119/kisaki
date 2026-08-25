import type { EntityProjection } from '../types'

export const companyEntityProjection = {
  entity: 'company',
  scoreField: 'score',
  coreFields: {
    name: 'name',
    original_name: 'originalName',
    sort_name: 'sortName',
    description: 'description',
    is_favorite: 'isFavorite',
    is_nsfw: 'isNsfw',
    founded_date: 'foundedDate',
    external_sites: 'externalSites'
  },
  assetFields: {
    logo_file: 'logoFile'
  }
} satisfies EntityProjection
