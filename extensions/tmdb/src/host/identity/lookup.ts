import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { TMDB_SOURCE_ID } from '../utils/constants'

/** TMDB ids the entry already carries, in the order the host supplied them. */
export function readKnownTmdbIds(lookup: ScraperLookup): string[] {
  return (lookup.knownIds ?? [])
    .filter((entry) => entry.source.trim().toLowerCase() === TMDB_SOURCE_ID)
    .map((entry) => entry.id.trim())
    .filter((id) => id.length > 0)
}

/** People and companies are plain TMDB numbers; only entries need a grammar. */
export function parseTmdbNumericId(value: string): number | null {
  const match = /^(\d+)$/.exec(value.trim())
  return match ? Number(match[1]) : null
}

export function findKnownTmdbNumericId(lookup: ScraperLookup): number | null {
  for (const id of readKnownTmdbIds(lookup)) {
    const numeric = parseTmdbNumericId(id)
    if (numeric !== null) {
      return numeric
    }
  }

  return null
}
