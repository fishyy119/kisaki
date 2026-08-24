import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { IGDB_SOURCE_ID } from '../utils/constants'
import { parseIgdbEntryId } from './entry-id'

/** The first IGDB id the entry already carries, if any. */
export function findKnownIgdbId(lookup: ScraperLookup): number | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== IGDB_SOURCE_ID) {
      continue
    }

    const id = parseIgdbEntryId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}
