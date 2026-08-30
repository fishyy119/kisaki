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
