import { customType } from 'drizzle-orm/sqlite-core'

import type { FilterState } from '@shared/filter/model'
import { parseFilterState } from '@shared/filter/normalization'
import { createEmptyFilter } from '@shared/filter/state'
import { requireCanonicalJsonValue } from './utils'

/**
 * FilterState JSON column.
 *
 * Lenient read: corrupt, foreign, or retired-format content degrades to an
 * empty filter. Strict write: the filter must already be canonical, so filter
 * editors normalize with `parseFilterState` before saving — unfinished
 * conditions are the editor's business, not storage's to discard.
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
    return JSON.stringify(requireCanonicalJsonValue('filterState', value, parseFilterState(value)))
  }
})
