export function createPartialSnapshot<TSnapshot extends object>(
  beforeRow: Record<string, unknown>,
  afterRow: Record<string, unknown>,
  fieldMap: Record<string, string>,
  normalize: (value: unknown, field: string) => unknown
): { before: Partial<TSnapshot>; after: Partial<TSnapshot>; fields: string[] } {
  const before: Partial<TSnapshot> = {}
  const after: Partial<TSnapshot> = {}
  const fields: string[] = []

  for (const [dbField, publicField] of Object.entries(fieldMap)) {
    const beforeValue = normalize(beforeRow[dbField], publicField)
    const afterValue = normalize(afterRow[dbField], publicField)
    if (sameJson(beforeValue, afterValue)) {
      continue
    }

    ;(before as Record<string, unknown>)[publicField] = beforeValue
    ;(after as Record<string, unknown>)[publicField] = afterValue
    fields.push(publicField)
  }

  return { before, after, fields }
}

export function normalizeCoreValue(value: unknown, field: string): unknown {
  if (field === 'releaseDate') {
    return parseJsonValue(value)
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

  if (['birthDate', 'deathDate', 'dynamicConfig', 'foundedDate', 'relatedSites'].includes(field)) {
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

export function dedupeTargets<TTarget extends { entity: string; id: string }>(
  targets: TTarget[]
): TTarget[] {
  const seen = new Set<string>()
  const deduped: TTarget[] = []
  for (const target of targets) {
    const key = `${target.entity}:${target.id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(target)
    }
  }
  return deduped
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

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
