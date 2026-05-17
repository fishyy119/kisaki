import type { BangumiSettingsV1 } from './schema'

export const DEFAULT_BANGUMI_SETTINGS: BangumiSettingsV1 = {
  version: 1,
  auth: {
    loginTimeoutMs: 10 * 60 * 1000
  },
  autoSync: {
    enabled: false,
    syncOnCreate: false,
    playStatusEnabled: true,
    scoreEnabled: true,
    clearRemoteScoreWhenEmpty: false,
    debounceMs: 3000,
    notifyErrors: true,
    statusToBangumi: {
      notStarted: 1,
      inProgress: 3,
      partial: 3,
      completed: 2,
      multiple: 2,
      shelved: 4
    }
  },
  client: {
    rateLimit: {
      maxRequests: 120,
      windowMs: 60_000
    },
    timeoutMs: 30_000,
    retryCount: 3
  }
}

export function createDefaultBangumiSettings(): BangumiSettingsV1 {
  return structuredClone(DEFAULT_BANGUMI_SETTINGS)
}
