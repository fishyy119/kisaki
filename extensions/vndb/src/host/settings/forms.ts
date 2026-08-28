import type { VndbSettingsFormState } from '../../shared/settings'
import { normalizeVndbSettings, type VndbSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: VndbSettingsV1): VndbSettingsFormState {
  return {
    apiBaseUrl: settings.endpoints.apiBaseUrl,
    preferRomanizedTitles: settings.naming.preferRomanizedTitles,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount,
    syncEnabled: settings.sync.enabled,
    syncPushScore: settings.sync.pushScore
  }
}

/**
 * Folds an edited form back into stored settings. The form carries what the
 * dialog shows and nothing else, and every value passes through the schema, so
 * a hand-edited webview cannot write an unusable endpoint or timeout.
 */
export function applyFormState(
  current: VndbSettingsV1,
  form: VndbSettingsFormState
): VndbSettingsV1 {
  return normalizeVndbSettings({
    ...current,
    endpoints: {
      apiBaseUrl: form.apiBaseUrl
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
