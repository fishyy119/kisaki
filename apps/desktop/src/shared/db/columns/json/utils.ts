export function matchesPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseJsonValue(value: string | null): unknown {
  if (value === null || value === '') return null
  return JSON.parse(value)
}

export function stringifyJsonStorageValue(typeName: string, value: unknown): string {
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new Error(`${typeName} must be JSON serializable`)
    }
    return serialized
  } catch {
    throw new Error(`${typeName} must be JSON serializable`)
  }
}

export function matchesOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

export function matchesFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function matchesNonNegativeFiniteNumber(value: unknown): value is number {
  return matchesFiniteNumber(value) && value >= 0
}

export function matchesNumberRecord(value: unknown): value is Record<string, number> {
  return matchesPlainObject(value) && Object.values(value).every(matchesFiniteNumber)
}
