import type { SgdbSettingsV1 } from './schema'

export const DEFAULT_SGDB_SETTINGS: SgdbSettingsV1 = {
  version: 1,
  art: {
    includeNsfw: false
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultSgdbSettings(): SgdbSettingsV1 {
  return structuredClone(DEFAULT_SGDB_SETTINGS)
}
