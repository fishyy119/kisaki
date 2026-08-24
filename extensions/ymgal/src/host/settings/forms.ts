import type { YmgalSettingsFormState } from '../../shared/settings'
import { normalizeYmgalSettings, type YmgalSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: YmgalSettingsV1): YmgalSettingsFormState {
  return {
    apiBaseUrl: settings.endpoints.apiBaseUrl,
    preferChineseNames: settings.naming.preferChineseNames,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount
  }
}

/**
 * Folds an edited form back into stored settings. The form carries what the
 * dialog shows and nothing else, and every value passes through the schema, so
 * a hand-edited webview cannot write an unusable endpoint or timeout.
 */
export function applyFormState(
  current: YmgalSettingsV1,
  form: YmgalSettingsFormState
): YmgalSettingsV1 {
  return normalizeYmgalSettings({
    ...current,
    endpoints: {
      apiBaseUrl: form.apiBaseUrl
    },
    naming: {
      preferChineseNames: form.preferChineseNames
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
