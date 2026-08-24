import { reactive } from 'vue'
import type { YmgalSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<YmgalSettingsFormState>({
  apiBaseUrl: '',
  preferChineseNames: true,
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: YmgalSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: YmgalSettingsFormState = settingsForm
): YmgalSettingsFormState {
  return {
    apiBaseUrl: source.apiBaseUrl,
    preferChineseNames: source.preferChineseNames,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: YmgalSettingsFormState,
  second: YmgalSettingsFormState
): boolean {
  return (
    first.apiBaseUrl === second.apiBaseUrl &&
    first.preferChineseNames === second.preferChineseNames &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount
  )
}
