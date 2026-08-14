import { reactive } from 'vue'
import type { TmdbSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<TmdbSettingsFormState>({
  apiBaseUrl: '',
  imageBaseUrl: '',
  includeAdult: false,
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: TmdbSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: TmdbSettingsFormState = settingsForm
): TmdbSettingsFormState {
  return {
    apiBaseUrl: source.apiBaseUrl,
    imageBaseUrl: source.imageBaseUrl,
    includeAdult: source.includeAdult,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: TmdbSettingsFormState,
  second: TmdbSettingsFormState
): boolean {
  return (
    first.apiBaseUrl === second.apiBaseUrl &&
    first.imageBaseUrl === second.imageBaseUrl &&
    first.includeAdult === second.includeAdult &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount
  )
}
