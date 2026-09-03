import type { ConfiguredEntityTopic, EntityProjection } from '../types'
import { characterEntityProjection } from './character'
import { collectionEntityProjection } from './collection'
import { companyEntityProjection } from './company'
import { personEntityProjection } from './person'
import { tagEntityProjection } from './tag'

export { projectEntityChanges } from './project'
export {
  getMediaCreatedName,
  getMediaProjectionForTopic,
  mediaExists,
  projectMediaChanges
} from './media'

export const ENTITY_PROJECTIONS: Record<string, EntityProjection> = {
  persons: personEntityProjection,
  companies: companyEntityProjection,
  characters: characterEntityProjection,
  collections: collectionEntityProjection,
  tags: tagEntityProjection
}

export function getEntityProjectionForTopic(
  entity: ConfiguredEntityTopic
): EntityProjection | undefined {
  return Object.values(ENTITY_PROJECTIONS).find((entry) => entry.entity === entity)
}
