import { customType } from 'drizzle-orm/sqlite-core'

import type { DynamicCollectionConfig } from '../../contracts/json'

export const dynamicCollectionConfig = customType<{
  data: DynamicCollectionConfig | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): DynamicCollectionConfig | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed !== 'object' || parsed === null) {
        return null
      }
      return parsed as DynamicCollectionConfig
    } catch {
      return null
    }
  },

  toDriver(value: DynamicCollectionConfig | null): string | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object') {
      throw new Error('dynamicCollectionConfig must be an object or null')
    }
    return JSON.stringify(value)
  }
})
