import type { EntityProjection } from '../types'

export const collectionEntityProjection = {
  entity: 'collection',
  coreFields: {
    name: 'name',
    description: 'description',
    is_nsfw: 'isNsfw',
    order: 'order'
  },
  assetFields: {
    cover_file: 'coverFile'
  },
  dynamicConfigFields: {
    is_dynamic: 'isDynamic',
    dynamic_config: 'dynamicConfig'
  }
} satisfies EntityProjection
