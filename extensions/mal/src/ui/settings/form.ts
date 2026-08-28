import { reactive } from 'vue'
import type { MalSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<MalSettingsFormState>({
  apiUrl: '',
  mirrorEnabled: true,
  mirrorUrl: '',
  preferRomajiTitles: false,
  timeoutSeconds: 20,
  retryCount: 2,
  syncEnabled: false,
  syncPushScore: true
})

export function applySettingsForm(next: MalSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: MalSettingsFormState = settingsForm
): MalSettingsFormState {
  return {
    apiUrl: source.apiUrl,
    mirrorEnabled: source.mirrorEnabled,
    mirrorUrl: source.mirrorUrl,
    preferRomajiTitles: source.preferRomajiTitles,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    syncEnabled: source.syncEnabled,
    syncPushScore: source.syncPushScore
  }
}

export function settingsFormsEqual(
  first: MalSettingsFormState,
  second: MalSettingsFormState
): boolean {
  return (
    first.apiUrl === second.apiUrl &&
    first.mirrorEnabled === second.mirrorEnabled &&
    first.mirrorUrl === second.mirrorUrl &&
    first.preferRomajiTitles === second.preferRomajiTitles &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.syncEnabled === second.syncEnabled &&
    first.syncPushScore === second.syncPushScore
  )
}
