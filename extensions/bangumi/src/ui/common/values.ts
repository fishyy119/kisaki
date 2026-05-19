export function readNumber(values: Record<string, unknown>, key: string, fallback: number): number {
  const value = values[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readBoolean(
  values: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const value = values[key]
  return typeof value === 'boolean' ? value : fallback
}

export function readString(values: Record<string, unknown>, key: string, fallback: string): string {
  const value = values[key]
  return typeof value === 'string' ? value.trim() : fallback
}

export function readStringArray(
  values: Record<string, unknown>,
  key: string,
  fallback: readonly string[]
): readonly string[] {
  const value = values[key]
  if (!Array.isArray(value)) {
    return fallback
  }

  return value.filter((item): item is string => typeof item === 'string' && !!item.trim())
}

export function pickKnownValues<T extends string>(
  values: readonly string[],
  allowed: readonly T[]
): readonly T[] {
  const allowedSet = new Set<string>(allowed)
  return [...new Set(values.filter((item): item is T => allowedSet.has(item)))]
}
