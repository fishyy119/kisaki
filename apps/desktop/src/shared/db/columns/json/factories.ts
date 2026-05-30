import { customType } from 'drizzle-orm/sqlite-core'

import { parseJsonValue, stringifyJsonStorageValue } from './utils'

export function createRequiredJsonType<T>(
  typeName: string,
  fallback: T,
  matchesValue: (value: unknown) => value is T
) {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string): T {
      try {
        const parsed = parseJsonValue(value)
        return matchesValue(parsed) ? parsed : fallback
      } catch {
        return fallback
      }
    },

    toDriver(value: T): string {
      if (!matchesValue(value)) {
        throw new Error(`${typeName} must be valid`)
      }

      return stringifyJsonStorageValue(typeName, value)
    }
  })
}

export function createNullableJsonType<T>(
  typeName: string,
  matchesValue: (value: unknown) => value is T
) {
  return customType<{ data: T | null; driverData: string | null }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string | null): T | null {
      if (!value) {
        return null
      }

      try {
        const parsed = parseJsonValue(value)
        return matchesValue(parsed) ? parsed : null
      } catch {
        return null
      }
    },

    toDriver(value: T | null): string | null {
      if (value === null || value === undefined) {
        return null
      }

      if (!matchesValue(value)) {
        throw new Error(`${typeName} must be valid or null`)
      }

      return stringifyJsonStorageValue(typeName, value)
    }
  })
}
