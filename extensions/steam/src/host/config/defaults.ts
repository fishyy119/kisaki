import type { SteamSettingsV1 } from './schema'

export const DEFAULT_STEAM_SETTINGS: SteamSettingsV1 = {
  version: 1,
  account: {
    steamId: ''
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultSteamSettings(): SteamSettingsV1 {
  return structuredClone(DEFAULT_STEAM_SETTINGS)
}
