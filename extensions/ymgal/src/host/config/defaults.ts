import type { YmgalSettingsV1 } from './schema'
import { YMGAL_DEFAULT_API_BASE_URL } from '../../shared/settings'

export const DEFAULT_YMGAL_SETTINGS: YmgalSettingsV1 = {
  version: 1,
  endpoints: {
    apiBaseUrl: YMGAL_DEFAULT_API_BASE_URL
  },
  naming: {
    preferChineseNames: true
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultYmgalSettings(): YmgalSettingsV1 {
  return structuredClone(DEFAULT_YMGAL_SETTINGS)
}
