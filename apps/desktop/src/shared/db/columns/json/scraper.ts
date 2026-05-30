import { customType } from 'drizzle-orm/sqlite-core'

import type { ScraperSlotConfigs } from '../../contracts/json'
import { matchesPlainObject } from './utils'

export const scraperSlotConfigs = customType<{
  data: ScraperSlotConfigs
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ScraperSlotConfigs {
    if (!value || value === '{}') return {}
    try {
      const parsed = JSON.parse(value)
      if (!matchesPlainObject(parsed)) {
        return {}
      }
      return parsed as ScraperSlotConfigs
    } catch {
      return {}
    }
  },

  toDriver(value: ScraperSlotConfigs): string {
    if (typeof value !== 'object' || value === null) {
      throw new Error('scraperSlotConfigs must be an object')
    }
    return JSON.stringify(value)
  }
})
