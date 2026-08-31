import { reactive } from 'vue'
import type { GbooksSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<GbooksSettingsFormState>({
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: GbooksSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: GbooksSettingsFormState = settingsForm
): GbooksSettingsFormState {
  return {
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: GbooksSettingsFormState,
  second: GbooksSettingsFormState
): boolean {
  return (
    first.timeoutSeconds === second.timeoutSeconds && first.retryCount === second.retryCount
  )
}
