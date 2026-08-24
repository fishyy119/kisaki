/**
 * VNDB entry ids.
 *
 * Every entity kind is a letter prefix plus a number (`v17`, `c123`, `s45`,
 * `p9`), and revision ids append a dot suffix. Ids arrive from search
 * payloads, from stored external ids, and from users typing them, so parsing
 * is total; a bare number is completed with the kind's own prefix, which is
 * what a user pasting "17" into a visual novel field means.
 */

export type VndbEntityPrefix = 'v' | 'c' | 's' | 'p'

const ENTRY_ID_PATTERN = /^([a-z])(\d+(?:\.\d+)?)$/

/** Canonical id of the given kind, or `null` when the value names none. */
export function parseVndbEntryId(value: string, prefix: VndbEntityPrefix): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) {
    return null
  }

  const match = ENTRY_ID_PATTERN.exec(raw)
  if (match) {
    return match[1] === prefix ? raw : null
  }

  return /^\d+$/.test(raw) ? `${prefix}${raw}` : null
}
