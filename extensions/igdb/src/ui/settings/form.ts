import { reactive } from 'vue'
import type { IgdbSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<IgdbSettingsFormState>({
  apiBaseUrl: '',
  oauthUrl: '',
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: IgdbSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: IgdbSettingsFormState = settingsForm
): IgdbSettingsFormState {
  return {
    apiBaseUrl: source.apiBaseUrl,
    oauthUrl: source.oauthUrl,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: IgdbSettingsFormState,
  second: IgdbSettingsFormState
): boolean {
  return (
    first.apiBaseUrl === second.apiBaseUrl &&
    first.oauthUrl === second.oauthUrl &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount
  )
}
