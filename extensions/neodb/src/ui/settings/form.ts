import { reactive } from 'vue'
import type { NeodbSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<NeodbSettingsFormState>({
  instanceUrl: '',
  timeoutSeconds: 20,
  retryCount: 2,
  syncEnabled: false,
  syncPushScore: true,
  syncVisibility: 'self'
})

export function applySettingsForm(next: NeodbSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: NeodbSettingsFormState = settingsForm
): NeodbSettingsFormState {
  return {
    instanceUrl: source.instanceUrl,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    syncEnabled: source.syncEnabled,
    syncPushScore: source.syncPushScore,
    syncVisibility: source.syncVisibility
  }
}

export function settingsFormsEqual(
  first: NeodbSettingsFormState,
  second: NeodbSettingsFormState
): boolean {
  return (
    first.instanceUrl === second.instanceUrl &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.syncEnabled === second.syncEnabled &&
    first.syncPushScore === second.syncPushScore &&
    first.syncVisibility === second.syncVisibility
  )
}
