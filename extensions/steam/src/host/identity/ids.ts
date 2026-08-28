import type { ScraperLookup } from '@kisaki3/extension-sdk'
import { STEAM_SOURCE_ID } from '../utils/constants'

/** Steam app ids are plain positive integers. */
export function parseSteamAppId(value: string): number | null {
  const raw = value.trim()
  if (!/^\d+$/.test(raw)) {
    return null
  }

  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** The first Steam app id the entry already carries, if any. */
export function findKnownSteamAppId(lookup: ScraperLookup): number | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== STEAM_SOURCE_ID) {
      continue
    }

    const id = parseSteamAppId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}
