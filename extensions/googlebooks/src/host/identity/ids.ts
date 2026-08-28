import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { GBOOKS_SOURCE_ID, ISBN_SOURCE_ID } from '../utils/constants'

/** Google Books volume ids are short URL-safe strings. */
export function parseGbooksVolumeId(value: string): string | null {
  const raw = value.trim()
  return /^[0-9A-Za-z_-]{8,20}$/.test(raw) ? raw : null
}

/** The first Google Books volume id the entry already carries, if any. */
export function findKnownVolumeId(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== GBOOKS_SOURCE_ID) {
      continue
    }

    const id = parseGbooksVolumeId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}

/** The first ISBN the entry already carries, if any. */
export function findKnownIsbn(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== ISBN_SOURCE_ID) {
      continue
    }

    const raw = entry.id.replace(/-/g, '').trim()
    if (/^(\d{10}|\d{13})$/.test(raw)) {
      return raw
    }
  }

  return null
}
