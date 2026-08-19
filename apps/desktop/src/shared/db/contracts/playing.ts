/**
 * Vocabulary helpers for the `playing` column on media-person link tables.
 *
 * The column holds character names exactly as a source credited them, so the
 * stored spelling is preserved and only comparison is normalized: two credits
 * that differ solely by case or spacing are one name.
 */

import { normalizeKeyText } from '../../identity'

/** Trims and drops blank names, keeping the first spelling of each character. */
export function normalizePlaying(names: readonly string[] | null | undefined): string[] {
  const byKey = new Map<string, string>()

  for (const value of names ?? []) {
    const name = value.trim()
    if (!name) continue

    const key = normalizeKeyText(name)
    if (!byKey.has(key)) {
      byKey.set(key, name)
    }
  }

  return [...byKey.values()]
}

/** Compares two stored lists, treating a missing list and an empty one alike. */
export function arePlayingEqual(
  current: readonly string[] | null | undefined,
  next: readonly string[] | null | undefined
): boolean {
  const left = current ?? []
  const right = next ?? []
  return left.length === right.length && left.every((name, index) => name === right[index])
}

/** Unions two credited-character lists, keeping first-appearance order. */
export function unionPlaying(
  existing: readonly string[] | null | undefined,
  incoming: readonly string[] | null | undefined
): string[] | undefined {
  if (!existing && !incoming) return undefined

  const merged = normalizePlaying([...(existing ?? []), ...(incoming ?? [])])
  return merged.length > 0 ? merged : undefined
}
