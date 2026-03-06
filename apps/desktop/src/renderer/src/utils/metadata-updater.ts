import { normalizeExternalIds, type ExternalId } from '@shared/identity'

export function dedupeExternalIds(externalIds: ExternalId[]): ExternalId[] {
  return normalizeExternalIds(externalIds)
}

export function mergeExternalIds(a: ExternalId[], b: ExternalId[]): ExternalId[] {
  return dedupeExternalIds([...(a ?? []), ...(b ?? [])])
}

export function fieldsToOption<Field extends string>(
  selected: Field[],
  all: readonly Field[]
): Field[] | '#all' {
  if (selected.length === all.length) return '#all'
  return selected
}

export function pickFields<Field extends string>(
  obj: Record<string, unknown>,
  fields: readonly Field[]
): Partial<Record<Field, unknown>> {
  const out: Partial<Record<Field, unknown>> = {}
  for (const field of fields) {
    if (field in obj) {
      ;(out as Record<string, unknown>)[field] = obj[field]
    }
  }
  return out
}
