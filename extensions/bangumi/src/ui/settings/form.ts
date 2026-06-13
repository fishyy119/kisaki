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

export function snapshotSettingsForm(
  source: BangumiSettingsFormState = settingsForm
): BangumiSettingsFormState {
  return {
    autoSyncEnabled: source.autoSyncEnabled,
    autoSyncItems: [...source.autoSyncItems],
    clearRemoteScoreWhenEmpty: source.clearRemoteScoreWhenEmpty,
    loginTimeoutMinutes: source.loginTimeoutMinutes,
    rateLimitMaxRequests: source.rateLimitMaxRequests,
    rateLimitWindowSeconds: source.rateLimitWindowSeconds,
    timeoutSeconds: source.timeoutSeconds,
    retryCount: source.retryCount,
    debounceSeconds: source.debounceSeconds,
    notifyErrors: source.notifyErrors
  }
}

export function settingsFormsEqual(
  first: BangumiSettingsFormState,
  second: BangumiSettingsFormState
): boolean {
  return (
    first.autoSyncEnabled === second.autoSyncEnabled &&
    sameItems(first.autoSyncItems, second.autoSyncItems) &&
    first.clearRemoteScoreWhenEmpty === second.clearRemoteScoreWhenEmpty &&
    first.loginTimeoutMinutes === second.loginTimeoutMinutes &&
    first.rateLimitMaxRequests === second.rateLimitMaxRequests &&
    first.rateLimitWindowSeconds === second.rateLimitWindowSeconds &&
    first.timeoutSeconds === second.timeoutSeconds &&
    first.retryCount === second.retryCount &&
    first.debounceSeconds === second.debounceSeconds &&
    first.notifyErrors === second.notifyErrors
  )
}

function sameItems(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((item, index) => item === second[index])
}
