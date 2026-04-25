export function stripUndefined<T extends Record<string, unknown>>(
  value: T
): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  const result: Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> = {}
  for (const [key, entry] of Object.entries(value) as [keyof T, T[keyof T]][]) {
    if (entry !== undefined) {
      result[key] = entry as Exclude<T[keyof T], undefined>
    }
  }
  return result
}

export function copyReadonlyArray<T>(value: readonly T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined
}

export function optionalValue<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

export function optionalArray<T>(value: readonly T[] | null | undefined): readonly T[] | undefined {
  return Array.isArray(value) ? value : undefined
}

export function toTimestampMs(value: Date | number | null | undefined): number {
  if (value instanceof Date) {
    return value.getTime()
  }

  return typeof value === 'number' ? value : Date.now()
}

export function toNullableTimestampMs(
  value: Date | number | null | undefined
): number | null | undefined {
  if (value === null || value === undefined) {
    return value
  }

  return toTimestampMs(value)
}
