import { MANGADEX_DEFAULT_API_URL } from '../../shared/settings'
import type { MangadexSettingsV1 } from './schema'

export const DEFAULT_MANGADEX_SETTINGS: MangadexSettingsV1 = {
  version: 1,
  endpoints: {
    apiUrl: MANGADEX_DEFAULT_API_URL
  },
  naming: {
    preferRomanizedTitles: false
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  },
  sync: {
    enabled: false,
    pushScore: true
  }
}

export function createDefaultMangadexSettings(): MangadexSettingsV1 {
  return structuredClone(DEFAULT_MANGADEX_SETTINGS)
}
