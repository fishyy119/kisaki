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

/** Index rows by their numeric id, for joining IGDB's reference fields. */
export function indexById<T extends { id: number }>(rows: readonly T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

/** Index rows by id, keeping only the named text field of each. */
export function indexNames<T extends { id: number }>(
  rows: readonly T[],
  read: (row: T) => string | null | undefined
): Map<number, string> {
  const names = new Map<number, string>()
  for (const row of rows) {
    const name = read(row)?.trim()
    if (name) {
      names.set(row.id, name)
    }
  }
  return names
}
