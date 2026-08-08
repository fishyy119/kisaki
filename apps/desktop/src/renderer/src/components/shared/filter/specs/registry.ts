/**
 * Filter UI spec registry.
 *
 * Resolves the per-entity FilterUiSpec and asserts (dev only) that every query
 * spec field is surfaced in the UI.
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

/**
 * Field keys, field kinds, and sort keys are checked by the type system through
 * `FilterUiSpec<typeof entityFilterQuerySpec>`. Coverage is not: a UI spec can
 * still omit a declared field, which would silently hide it from the builder.
 */
function assertSpecCoverage(entityType: AllEntityType): void {
  const uiSpec = getFilterUiSpec(entityType).value
  const querySpec = getFilterQuerySpec(entityType)

  if (uiSpec.fields.length !== querySpec.fields.length) {
    throw new Error(`Filter UI spec ${entityType} does not cover every query spec field`)
  }
}

if (import.meta.env.DEV) {
  for (const entityType of ALL_ENTITY_TYPES) {
    assertSpecCoverage(entityType)
  }
}
