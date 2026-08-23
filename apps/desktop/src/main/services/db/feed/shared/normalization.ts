export function normalizeCoreValue(value: unknown, field: string): unknown {
  if (field === 'releaseDate' || field === 'endDate' || field === 'aliases') {
    return parseJsonValue(value)
  }
  if (field === 'totalSeasons' || field === 'totalEpisodes' || field === 'runtimeMs') {
    return nullableNumber(value)
  }
  return normalizeNullableString(value)
}

export function normalizeActivityValue(value: unknown): number | null {
  return nullableNumber(value)
}

export function normalizeEntityValue(value: unknown, field: string): unknown {
  if (field === 'isFavorite' || field === 'isNsfw' || field === 'isDynamic') {
    return normalizeBoolean(value)
  }

  if (['age', 'bust', 'height', 'hips', 'order', 'waist', 'weight'].includes(field)) {
    return nullableNumber(value)
  }

  if (
    ['aliases', 'birthDate', 'deathDate', 'dynamicConfig', 'foundedDate', 'externalSites'].includes(
      field
    )
  ) {
    return parseJsonValue(value)
  }

  return normalizeNullableString(value)
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function normalizeNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) {
    return value ?? null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
