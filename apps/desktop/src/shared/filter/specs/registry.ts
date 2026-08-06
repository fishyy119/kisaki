/**
 * Filter query spec registry.
 *
 * Resolves the per-entity FilterQuerySpec and spec-derived lookups.
 */
import type { AllEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import type { FilterQuerySpec } from '../spec'

import { characterFilterQuerySpec } from './character'
import { collectionFilterQuerySpec } from './collection'
import { companyFilterQuerySpec } from './company'
import { gameFilterQuerySpec } from './game'
import { personFilterQuerySpec } from './person'
import { tagFilterQuerySpec } from './tag'

export function getFilterQuerySpec(entityType: AllEntityType): FilterQuerySpec {
  switch (entityType) {
    case 'game':
      return gameFilterQuerySpec
    case 'character':
      return characterFilterQuerySpec
    case 'person':
      return personFilterQuerySpec
    case 'company':
      return companyFilterQuerySpec
    case 'collection':
      return collectionFilterQuerySpec
    case 'tag':
      return tagFilterQuerySpec
  }
}

/**
 * Tables whose changes can affect filter results for the entity type:
 * the entity table itself plus every relation link table in its spec.
 */
export function getFilterRelevantTables(entityType: AllEntityType): readonly TableName[] {
  return getFilterQuerySpec(entityType).relevantTables
}
