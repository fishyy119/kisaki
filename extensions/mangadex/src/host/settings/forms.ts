import type { MangadexSettingsFormState } from '../../shared/settings'
import { normalizeMangadexSettings, type MangadexSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: MangadexSettingsV1): MangadexSettingsFormState {
  return {
    apiUrl: settings.endpoints.apiUrl,
    preferRomanizedTitles: settings.naming.preferRomanizedTitles,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount,
    syncEnabled: settings.sync.enabled,
    syncPushScore: settings.sync.pushScore
  }
}

/**
 * Folds an edited form back into stored settings. Every value passes through
 * the schema, so a hand-edited webview cannot write an unusable timeout.
 */
export function applyFormState(
  current: MangadexSettingsV1,
  form: MangadexSettingsFormState
): MangadexSettingsV1 {
  return normalizeMangadexSettings({
    ...current,
    endpoints: {
      apiUrl: form.apiUrl
    },
    naming: {
      preferRomanizedTitles: form.preferRomanizedTitles
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    },
    sync: {
      enabled: form.syncEnabled,
      pushScore: form.syncPushScore
    }
  })
}
