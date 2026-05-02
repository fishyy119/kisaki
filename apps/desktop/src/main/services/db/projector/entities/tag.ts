import type { EntityProjection } from '../types'

export const tagEntityProjection = {
  entity: 'tag',
  coreFields: {
    name: 'name',
    description: 'description',
    is_nsfw: 'isNsfw'
  }
} satisfies EntityProjection
