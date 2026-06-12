import { reactive } from 'vue'
import type { BangumiSettingsFormState } from '../../shared/settings'

/**
 * Shared settings form state owned by the webview document. Tabs bind to it
 * directly instead of mutating props, keeping Vue's one-way data flow intact.
 */
export const settingsForm = reactive<BangumiSettingsFormState>({
  autoSyncEnabled: false,
  autoSyncItems: [],
  clearRemoteScoreWhenEmpty: false,
  loginTimeoutMinutes: 10,
  rateLimitMaxRequests: 120,
  rateLimitWindowSeconds: 60,
  timeoutSeconds: 30,
  retryCount: 3,
  debounceSeconds: 3,
  notifyErrors: true
})

export function applySettingsForm(next: BangumiSettingsFormState): void {
  Object.assign(settingsForm, next)
}
