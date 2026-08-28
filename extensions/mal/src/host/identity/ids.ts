import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { MAL_SOURCE_ID } from '../utils/constants'

/**
 * MAL ids are plain positive integers, one sequence per entity kind; the kind
 * is always implied by the registry a lookup arrives through.
 */
export function parseMalId(value: string): number | null {
  const raw = value.trim()
  if (!/^\d+$/.test(raw)) {
    return null
  }

  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** The first MAL id the entry already carries, if any. */
export function findKnownMalId(lookup: ScraperLookup): number | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== MAL_SOURCE_ID) {
      continue
    }

    const id = parseMalId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}
