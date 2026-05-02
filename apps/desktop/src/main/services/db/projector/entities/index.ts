import type { ConfiguredEntityTopic, EntityProjection } from '../types'
import { characterEntityProjection } from './character'
import { collectionEntityProjection } from './collection'
import { companyEntityProjection } from './company'
import { personEntityProjection } from './person'
import { tagEntityProjection } from './tag'

export { projectEntityChanges } from './common'
export { gameExists, getGameCreatedName, getGameIdsFromChange, projectGameChanges } from './game'

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
