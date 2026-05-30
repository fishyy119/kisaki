import { customType } from 'drizzle-orm/sqlite-core'

import { normalizeKeyText } from '../../identity'

export const externalIdentityText = customType<{
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
