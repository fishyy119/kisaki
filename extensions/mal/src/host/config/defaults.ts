import { MAL_DEFAULT_API_URL, MAL_DEFAULT_MIRROR_URL } from '../../shared/settings'
import type { MalSettingsV1 } from './schema'

export const DEFAULT_MAL_SETTINGS: MalSettingsV1 = {
  version: 1,
  endpoints: {
    apiUrl: MAL_DEFAULT_API_URL,
    mirrorEnabled: true,
    mirrorUrl: MAL_DEFAULT_MIRROR_URL
  },
  naming: {
    preferRomajiTitles: false
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

export function createDefaultMalSettings(): MalSettingsV1 {
  return structuredClone(DEFAULT_MAL_SETTINGS)
}
