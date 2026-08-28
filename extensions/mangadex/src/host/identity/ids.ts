import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { MANGADEX_SOURCE_ID } from '../utils/constants'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** MangaDex ids are UUIDs, one namespace per entity kind. */
export function parseMangadexId(value: string): string | null {
  const raw = value.trim().toLowerCase()
  return UUID_PATTERN.test(raw) ? raw : null
}

/** The first MangaDex id the entry already carries, if any. */
export function findKnownMangadexId(lookup: ScraperLookup): string | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== MANGADEX_SOURCE_ID) {
      continue
    }

    const id = parseMangadexId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}
