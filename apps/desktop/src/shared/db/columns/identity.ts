import { customType } from 'drizzle-orm/sqlite-core'

import { normalizeKeyText } from '../../identity'

/**
 * Text persisted in `normalizeKeyText` form so equality in SQL is identity
 * matching. Callers write the value as they received it; the column owns the
 * normalization.
 */
export const identityKeyText = customType<{
  data: string
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): string {
    return value
  },

  toDriver(value: string): string {
    return normalizeKeyText(value)
  }
})
