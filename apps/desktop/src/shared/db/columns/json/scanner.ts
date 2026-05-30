import { customType } from 'drizzle-orm/sqlite-core'

import type { NameExtractionRule, ScannerIgnoredNames } from '../../contracts/json'

export const scannerIgnoredNames = customType<{
  data: ScannerIgnoredNames
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ScannerIgnoredNames {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
      return []
    }
  },

  toDriver(value: ScannerIgnoredNames): string {
    if (!Array.isArray(value)) {
      throw new Error('scannerIgnoredNames must be an array')
    }
    value.forEach((item, index) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid scannerIgnoredName at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})

export const nameExtractionRules = customType<{
  data: NameExtractionRule[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): NameExtractionRule[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is NameExtractionRule =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.description === 'string' &&
          typeof item.pattern === 'string' &&
          typeof item.enabled === 'boolean'
      )
    } catch {
      return []
    }
  },

  toDriver(value: NameExtractionRule[]): string {
    if (!Array.isArray(value)) {
      throw new Error('nameExtractionRules must be an array')
    }
    return JSON.stringify(value)
  }
})
