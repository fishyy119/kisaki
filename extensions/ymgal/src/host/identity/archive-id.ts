/**
 * YMGal archive ids.
 *
 * Every archive kind (game, organization, person, character) is numbered in
 * its own space with a plain positive integer, so one grammar covers them all.
 * Ids arrive from search payloads, from stored external ids, and from users
 * typing them, so parsing is total and normalizing is canonical (no padding,
 * no leading plus) to keep cache keys and stored ids comparable.
 */

const ARCHIVE_ID_PATTERN = /^\d+$/

/** Canonical id, or `null` when the value does not name an archive. */
export function parseYmgalArchiveId(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? String(value) : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!ARCHIVE_ID_PATTERN.test(trimmed)) {
    return null
  }

  const normalized = String(Number.parseInt(trimmed, 10))
  return normalized === '0' ? null : normalized
}

/** Collects the archive ids out of a mixed list, dropping unusable values. */
export function collectYmgalArchiveIds(values: readonly unknown[]): string[] {
  const ids = new Set<string>()
  for (const value of values) {
    const id = parseYmgalArchiveId(value)
    if (id) {
      ids.add(id)
    }
  }
  return [...ids]
}
