import { reactive } from 'vue'
import type { SteamSettingsFormState } from '../../shared/settings'

/**
 * Settings draft owned by the webview document. Sections bind to it directly
 * instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<SteamSettingsFormState>({
  steamId: '',
  timeoutSeconds: 20,
  retryCount: 2
})

export function applySettingsForm(next: SteamSettingsFormState): void {
  Object.assign(settingsForm, next)
}

export function snapshotSettingsForm(
  source: SteamSettingsFormState = settingsForm
): SteamSettingsFormState {
  return {
    steamId: source.steamId,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount
  }
}

export function settingsFormsEqual(
  first: SteamSettingsFormState,
  second: SteamSettingsFormState
): boolean {
  return (
    first.steamId === second.steamId &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount
  )
}
