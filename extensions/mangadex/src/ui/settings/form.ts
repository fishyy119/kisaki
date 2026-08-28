import { reactive } from 'vue'
import type { MangadexSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<MangadexSettingsFormState>({
  preferRomanizedTitles: false,
  timeoutSeconds: 20,
  retryCount: 2,
  syncEnabled: false,
  syncPushScore: true
})

export function applySettingsForm(next: MangadexSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: MangadexSettingsFormState = settingsForm
): MangadexSettingsFormState {
  return {
    preferRomanizedTitles: source.preferRomanizedTitles,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    syncEnabled: source.syncEnabled,
    syncPushScore: source.syncPushScore
  }
}

export function settingsFormsEqual(
  first: MangadexSettingsFormState,
  second: MangadexSettingsFormState
): boolean {
  return (
    first.preferRomanizedTitles === second.preferRomanizedTitles &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.syncEnabled === second.syncEnabled &&
    first.syncPushScore === second.syncPushScore
  )
}
