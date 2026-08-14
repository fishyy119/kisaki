import type { TmdbSettingsFormState } from '../../shared/settings'
import { normalizeTmdbSettings, type TmdbSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: TmdbSettingsV1): TmdbSettingsFormState {
  return {
    apiBaseUrl: settings.endpoints.apiBaseUrl,
    imageBaseUrl: settings.endpoints.imageBaseUrl,
    includeAdult: settings.search.includeAdult,
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
  current: TmdbSettingsV1,
  form: TmdbSettingsFormState
): TmdbSettingsV1 {
  return normalizeTmdbSettings({
    ...current,
    endpoints: {
      apiBaseUrl: form.apiBaseUrl,
      imageBaseUrl: form.imageBaseUrl
    },
    search: {
      includeAdult: form.includeAdult
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
