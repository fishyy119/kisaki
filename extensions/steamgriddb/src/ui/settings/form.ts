import { reactive } from 'vue'
import type { SgdbSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<SgdbSettingsFormState>({
  includeNsfw: false,
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: SgdbSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: SgdbSettingsFormState = settingsForm
): SgdbSettingsFormState {
  return {
    includeNsfw: source.includeNsfw,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: SgdbSettingsFormState,
  second: SgdbSettingsFormState
): boolean {
  return (
    first.includeNsfw === second.includeNsfw &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount
  )
}
