import type { GbooksSettingsV1 } from './schema'

export const DEFAULT_GBOOKS_SETTINGS: GbooksSettingsV1 = {
  version: 1,
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultGbooksSettings(): GbooksSettingsV1 {
  return structuredClone(DEFAULT_GBOOKS_SETTINGS)
}
