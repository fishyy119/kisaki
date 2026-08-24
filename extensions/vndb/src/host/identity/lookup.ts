import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { VNDB_SOURCE_ID } from '../utils/constants'
import { parseVndbEntryId, type VndbEntityPrefix } from './entry-id'

/** The first VNDB id of the given kind the entry already carries, if any. */
export function findKnownVndbId(lookup: ScraperLookup, prefix: VndbEntityPrefix): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== VNDB_SOURCE_ID) {
      continue
    }

    const id = parseVndbEntryId(entry.id, prefix)
    if (id) {
      return id
    }
  }

  return null
}
