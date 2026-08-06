import { customType } from 'drizzle-orm/sqlite-core'

import type { FilterState } from '@shared/filter/model'
import { matchesFilterStateShape, parseFilterState } from '@shared/filter/normalization'
import { createEmptyFilter } from '@shared/filter/state'

/**
 * FilterState JSON column.
 *
 * Lenient read: corrupt, foreign, or retired-format content degrades to an
 * empty filter. Strict write: the app must produce a structurally valid
 * FilterState; no-op conditions are normalized away by parseFilterState.
 */
export const filterState = customType<{
  data: FilterState
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): FilterState {
    if (!value) return createEmptyFilter()
    try {
      return parseFilterState(JSON.parse(value))
    } catch {
      return createEmptyFilter()
    }
  },

  toDriver(value: FilterState): string {
    if (!matchesFilterStateShape(value)) {
      throw new Error('filterState must be a { match, conditions } object')
    }
    return JSON.stringify(parseFilterState(value))
  }
})
