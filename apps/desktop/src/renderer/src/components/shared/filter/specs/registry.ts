/**
 * Filter UI spec registry.
 *
 * Resolves the per-entity FilterUiSpec and asserts (dev only) that UI specs
 * stay key/kind aligned with the shared query specs.
 */
import type { ComputedRef } from 'vue'
import { ALL_ENTITY_TYPES, type AllEntityType } from '@shared/common'
import { getFilterQuerySpec } from '@shared/filter'
import type { FilterUiSpec } from './types'

import { characterFilterUiSpec } from './character'
import { collectionFilterUiSpec } from './collection'
import { companyFilterUiSpec } from './company'
import { gameFilterUiSpec } from './game'
import { personFilterUiSpec } from './person'
import { tagFilterUiSpec } from './tag'

export function getFilterUiSpec(entityType: AllEntityType): ComputedRef<FilterUiSpec> {
  switch (entityType) {
    case 'game':
      return gameFilterUiSpec
    case 'character':
      return characterFilterUiSpec
    case 'person':
      return personFilterUiSpec
    case 'company':
      return companyFilterUiSpec
    case 'collection':
      return collectionFilterUiSpec
    case 'tag':
      return tagFilterUiSpec
  }
}

function assertSpecAlignment(entityType: AllEntityType): void {
  const uiSpec = getFilterUiSpec(entityType).value
  const querySpec = getFilterQuerySpec(entityType)

  for (const field of uiSpec.fields) {
    const queryField = querySpec.fieldByKey.get(field.key)
    if (!queryField) {
      throw new Error(`Filter UI spec ${entityType}.${field.key} has no query spec field`)
    }
    if (queryField.kind !== field.kind) {
      throw new Error(
        `Filter UI spec ${entityType}.${field.key} kind ${field.kind} != query spec kind ${queryField.kind}`
      )
    }
  }
  if (uiSpec.fields.length !== querySpec.fields.length) {
    throw new Error(`Filter UI spec ${entityType} does not cover every query spec field`)
  }

  for (const option of uiSpec.sortOptions) {
    if (!querySpec.sortByKey.has(option.key)) {
      throw new Error(`Filter UI spec ${entityType} sort option ${option.key} not in query spec`)
    }
  }
}

if (import.meta.env.DEV) {
  for (const entityType of ALL_ENTITY_TYPES) {
    assertSpecAlignment(entityType)
  }
}
