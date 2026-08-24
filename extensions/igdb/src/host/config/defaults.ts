import type { IgdbSettingsV1 } from './schema'
import { IGDB_DEFAULT_API_BASE_URL, IGDB_DEFAULT_OAUTH_URL } from '../../shared/settings'

export const DEFAULT_IGDB_SETTINGS: IgdbSettingsV1 = {
  version: 1,
  endpoints: {
    apiBaseUrl: IGDB_DEFAULT_API_BASE_URL,
    oauthUrl: IGDB_DEFAULT_OAUTH_URL
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultIgdbSettings(): IgdbSettingsV1 {
  return structuredClone(DEFAULT_IGDB_SETTINGS)
}
