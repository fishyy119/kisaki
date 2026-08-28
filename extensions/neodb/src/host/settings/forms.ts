import type { NeodbSettingsFormState } from '../../shared/settings'
import { normalizeNeodbSettings, type NeodbSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: NeodbSettingsV1): NeodbSettingsFormState {
  return {
    instanceUrl: settings.endpoints.instanceUrl,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount,
    syncEnabled: settings.sync.enabled,
    syncPushScore: settings.sync.pushScore,
    syncVisibility: settings.sync.visibility
  }
}

/**
 * Folds an edited form back into stored settings. Every value passes through
 * the schema, so a hand-edited webview cannot write an unusable instance URL.
 */
export function applyFormState(
  current: NeodbSettingsV1,
  form: NeodbSettingsFormState
): NeodbSettingsV1 {
  return normalizeNeodbSettings({
    ...current,
    endpoints: {
      instanceUrl: form.instanceUrl
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    },
    sync: {
      enabled: form.syncEnabled,
      pushScore: form.syncPushScore,
      visibility: form.syncVisibility
    }
  })
}
