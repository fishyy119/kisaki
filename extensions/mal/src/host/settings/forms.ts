import type { MalSettingsFormState } from '../../shared/settings'
import { normalizeMalSettings, type MalSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: MalSettingsV1): MalSettingsFormState {
  return {
    apiUrl: settings.endpoints.apiUrl,
    mirrorEnabled: settings.endpoints.mirrorEnabled,
    mirrorUrl: settings.endpoints.mirrorUrl,
    preferRomajiTitles: settings.naming.preferRomajiTitles,
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
export function applyFormState(current: MalSettingsV1, form: MalSettingsFormState): MalSettingsV1 {
  return normalizeMalSettings({
    ...current,
    endpoints: {
      apiUrl: form.apiUrl,
      mirrorEnabled: form.mirrorEnabled,
      mirrorUrl: form.mirrorUrl
    },
    naming: {
      preferRomajiTitles: form.preferRomajiTitles
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
