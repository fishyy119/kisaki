import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { NEODB_SOURCE_ID } from '../utils/constants'

/** NeoDB item ids are base62 UUID strings. */
export function parseNeodbId(value: string): string | null {
  const raw = value.trim()
  return /^[0-9A-Za-z]{20,26}$/.test(raw) ? raw : null
}

/** The first NeoDB id the entry already carries, if any. */
export function findKnownNeodbId(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== NEODB_SOURCE_ID) {
      continue
    }

    const id = parseNeodbId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}

/** The first ISBN the entry already carries, if any. */
export function findKnownIsbn(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== 'isbn') {
      continue
    }

    const raw = entry.id.replace(/-/g, '').trim()
    if (/^(\d{10}|\d{13})$/.test(raw)) {
      return raw
    }
  }

  return null
}
