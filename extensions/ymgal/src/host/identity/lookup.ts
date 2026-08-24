import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { YMGAL_SOURCE_ID } from '../utils/constants'
import { parseYmgalArchiveId } from './archive-id'

/** The first YMGal archive id the entry already carries, if any. */
export function findKnownYmgalId(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== YMGAL_SOURCE_ID) {
      continue
    }

    const id = parseYmgalArchiveId(entry.id)
    if (id) {
      return id
    }
  }

  return null
}
