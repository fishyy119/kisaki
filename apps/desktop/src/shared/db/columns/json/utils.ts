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

/**
 * Round-trip guard for strict writes.
 *
 * Returns the canonical form to persist, and throws when the requested value is
 * not equivalent to it: storing a repaired value would silently lose whatever
 * the caller asked to store. Key order and dropped `undefined` properties are
 * equivalence-preserving, so both sides are compared in stable JSON form.
 */
export function requireCanonicalJsonValue<T>(typeName: string, value: unknown, canonical: T): T {
  if (stableJsonString(value) !== stableJsonString(canonical)) {
    throw new Error(`${typeName} contains values that cannot be stored as given`)
  }
  return canonical
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(sortObjectKeysDeep(value)) ?? 'undefined'
}

function sortObjectKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysDeep)
  }
  if (!matchesPlainObject(value)) {
    return value
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, sortObjectKeysDeep(value[key])])
  )
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
