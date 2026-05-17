import type { BangumiSettingsV1 } from './schema'

export const DEFAULT_BANGUMI_SETTINGS: BangumiSettingsV1 = {
  version: 1,
  auth: {
    loginTimeoutMs: 10 * 60 * 1000
  },
  sync: {
    autoSyncEnabled: false,
    syncOnCreate: false,
    playStatusEnabled: true,
    scoreEnabled: true,
    clearRemoteScoreWhenEmpty: false,
    unmappedStrategy: 'skip',
    debounceMs: 3000,
    statusToBangumi: {
      notStarted: 1,
      inProgress: 3,
      partial: 3,
      completed: 2,
      multiple: 2,
      shelved: 4
    },
    bangumiToStatus: {
      1: 'notStarted',
      2: 'completed',
      3: 'inProgress',
      4: 'shelved',
      5: 'shelved'
    }
  },
  client: {
    rateLimit: {
      maxRequests: 120,
      windowMs: 60_000
    },
    timeoutMs: 30_000,
    retryCount: 3
  },
  diagnostics: {
    notifySyncErrors: true
  }
}

export function createDefaultBangumiSettings(): BangumiSettingsV1 {
  return structuredClone(DEFAULT_BANGUMI_SETTINGS)
}
