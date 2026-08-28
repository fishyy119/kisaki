import { reactive } from 'vue'
import type { AnilistSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<AnilistSettingsFormState>({
  graphqlUrl: '',
  oauthRelayUrl: '',
  preferRomajiTitles: false,
  timeoutSeconds: 20,
  retryCount: 2,
  syncEnabled: false,
  syncPushScore: true
})

export function applySettingsForm(next: AnilistSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: AnilistSettingsFormState = settingsForm
): AnilistSettingsFormState {
  return {
    graphqlUrl: source.graphqlUrl,
    oauthRelayUrl: source.oauthRelayUrl,
    preferRomajiTitles: source.preferRomajiTitles,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    syncEnabled: source.syncEnabled,
    syncPushScore: source.syncPushScore
  }
}

export function settingsFormsEqual(
  first: AnilistSettingsFormState,
  second: AnilistSettingsFormState
): boolean {
  return (
    first.graphqlUrl === second.graphqlUrl &&
    first.oauthRelayUrl === second.oauthRelayUrl &&
    first.preferRomajiTitles === second.preferRomajiTitles &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.syncEnabled === second.syncEnabled &&
    first.syncPushScore === second.syncPushScore
  )
}
