import { reactive } from 'vue'
import type { VndbSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<VndbSettingsFormState>({
  apiBaseUrl: '',
  preferRomanizedTitles: false,
  timeoutSeconds: 20,
  retryCount: 2,
  syncEnabled: false,
  syncPushScore: true
})

export function applySettingsForm(next: VndbSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: VndbSettingsFormState = settingsForm
): VndbSettingsFormState {
  return {
    apiBaseUrl: source.apiBaseUrl,
    preferRomanizedTitles: source.preferRomanizedTitles,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    syncEnabled: source.syncEnabled,
    syncPushScore: source.syncPushScore
  }
}

export function settingsFormsEqual(
  first: VndbSettingsFormState,
  second: VndbSettingsFormState
): boolean {
  return (
    first.apiBaseUrl === second.apiBaseUrl &&
    first.preferRomanizedTitles === second.preferRomanizedTitles &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.syncEnabled === second.syncEnabled &&
    first.syncPushScore === second.syncPushScore
  )
}
