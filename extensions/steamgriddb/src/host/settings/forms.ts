import type { SgdbSettingsFormState } from '../../shared/settings'
import { normalizeSgdbSettings, type SgdbSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: SgdbSettingsV1): SgdbSettingsFormState {
  return {
    includeNsfw: settings.art.includeNsfw,
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount
  }
}

/**
 * Folds an edited form back into stored settings. Every value passes through
 * the schema, so a hand-edited webview cannot write an unusable timeout.
 */
export function applyFormState(
  current: SgdbSettingsV1,
  form: SgdbSettingsFormState
): SgdbSettingsV1 {
  return normalizeSgdbSettings({
    ...current,
    art: {
      includeNsfw: form.includeNsfw
    },
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
