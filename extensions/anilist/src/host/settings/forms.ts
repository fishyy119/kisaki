import type { AnilistSettingsFormState } from '../../shared/settings'
import { normalizeAnilistSettings, type AnilistSettingsV1 } from '../config/schema'

const MS_PER_SECOND = 1_000

export function toFormState(settings: AnilistSettingsV1): AnilistSettingsFormState {
  return {
    graphqlUrl: settings.endpoints.graphqlUrl,
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
export function applyFormState(
  current: AnilistSettingsV1,
  form: AnilistSettingsFormState
): AnilistSettingsV1 {
  return normalizeAnilistSettings({
    ...current,
    endpoints: {
      graphqlUrl: form.graphqlUrl
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
