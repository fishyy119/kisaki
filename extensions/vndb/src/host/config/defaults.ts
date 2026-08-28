import type { VndbSettingsV1 } from './schema'
import { VNDB_DEFAULT_API_BASE_URL } from '../../shared/settings'

export const DEFAULT_VNDB_SETTINGS: VndbSettingsV1 = {
  version: 1,
  endpoints: {
    apiBaseUrl: VNDB_DEFAULT_API_BASE_URL
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

export function createDefaultVndbSettings(): VndbSettingsV1 {
  return structuredClone(DEFAULT_VNDB_SETTINGS)
}
