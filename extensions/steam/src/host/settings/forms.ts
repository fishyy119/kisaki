import type { SteamSettingsFormState } from '../../shared/settings'
import { normalizeSteamSettings, type SteamSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: SteamSettingsV1): SteamSettingsFormState {
  return {
    steamId: settings.account.steamId,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount
  }
}

/**
 * Folds an edited form back into stored settings. Every value passes through
 * the schema, so a hand-edited webview cannot write an unusable SteamID.
 */
export function applyFormState(
  current: SteamSettingsV1,
  form: SteamSettingsFormState
): SteamSettingsV1 {
  return normalizeSteamSettings({
    ...current,
    account: {
      steamId: form.steamId
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
