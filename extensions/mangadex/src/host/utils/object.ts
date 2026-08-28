type DefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

type OptionalDefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

type OmitUndefined<T extends object> = Pick<T, DefinedKeys<T>> &
  Partial<{
    [K in OptionalDefinedKeys<T>]: Exclude<T[K], undefined>
  }>

/** Drops `undefined` members so optional fields stay absent under exact-optional typing. */
export function omitUndefined<const T extends Record<string, unknown>>(value: T): OmitUndefined<T> {
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      output[key] = entry
    }
  }
  return output as OmitUndefined<T>
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    return [[...items]]
  }

  const output: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }
  return output
}
