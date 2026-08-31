import type { GbooksSettingsFormState } from '../../shared/settings'
import { normalizeGbooksSettings, type GbooksSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: GbooksSettingsV1): GbooksSettingsFormState {
  return {
    timeoutSeconds: settings.client.timeoutMs / MS_PER_SECOND,
    retryCount: settings.client.retryCount
  }
}

/**
 * Folds an edited form back into stored settings. Every value passes through
 * the schema, so a hand-edited webview cannot write unusable client values.
 */
export function applyFormState(
  current: GbooksSettingsV1,
  form: GbooksSettingsFormState
): GbooksSettingsV1 {
  return normalizeGbooksSettings({
    ...current,
    client: {
      timeoutMs: Math.round(form.timeoutSeconds * MS_PER_SECOND),
      retryCount: form.retryCount
    }
  })
}
