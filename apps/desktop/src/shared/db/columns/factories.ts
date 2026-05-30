import { customType } from 'drizzle-orm/sqlite-core'

export function createEnumType<T extends string>(
  validValues: readonly T[],
  defaultValue: T,
  typeName: string
) {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string): T {
      if (validValues.includes(value as T)) {
        return value as T
      }
      return defaultValue
    },

    toDriver(value: T): string {
      if (validValues.includes(value)) {
        return value
      }
      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}

export function createNullableEnumType<T extends string>(
  validValues: readonly T[],
  typeName: string
) {
  return customType<{ data: T | null; driverData: string | null }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string | null): T | null {
      if (!value) return null
      if (validValues.includes(value as T)) {
        return value as T
      }
      return null
    },

    toDriver(value: T | null): string | null {
      if (!value) return null
      if (validValues.includes(value)) {
        return value
      }
      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}

export function createBoundedIntegerType(
  min: number,
  max: number,
  defaultValue: number,
  typeName: string
) {
  return customType<{ data: number; driverData: number }>({
    dataType() {
      return 'integer'
    },

    fromDriver(value: number): number {
      if (Number.isInteger(value) && value >= min && value <= max) {
        return value
      }

      return defaultValue
    },

    toDriver(value: number): number {
      if (Number.isInteger(value) && value >= min && value <= max) {
        return value
      }

      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}
