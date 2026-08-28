import { GBOOKS_DEFAULT_OAUTH_RELAY_URL } from '../../shared/settings'
import type { GbooksSettingsV1 } from './schema'

export const DEFAULT_GBOOKS_SETTINGS: GbooksSettingsV1 = {
  version: 1,
  endpoints: {
    oauthRelayUrl: GBOOKS_DEFAULT_OAUTH_RELAY_URL
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultGbooksSettings(): GbooksSettingsV1 {
  return structuredClone(DEFAULT_GBOOKS_SETTINGS)
}
