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

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
