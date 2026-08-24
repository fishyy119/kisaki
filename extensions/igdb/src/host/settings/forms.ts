import type { IgdbSettingsFormState } from '../../shared/settings'
import { normalizeIgdbSettings, type IgdbSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: IgdbSettingsV1): IgdbSettingsFormState {
  return {
    apiBaseUrl: settings.endpoints.apiBaseUrl,
    oauthUrl: settings.endpoints.oauthUrl,
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
  current: IgdbSettingsV1,
  form: IgdbSettingsFormState
): IgdbSettingsV1 {
  return normalizeIgdbSettings({
    ...current,
    endpoints: {
      apiBaseUrl: form.apiBaseUrl,
      oauthUrl: form.oauthUrl
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
