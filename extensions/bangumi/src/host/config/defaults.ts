import type { BangumiSettingsV1 } from './schema'

export const DEFAULT_BANGUMI_SETTINGS: BangumiSettingsV1 = {
  version: 1,
  auth: {
    loginTimeoutMs: 10 * 60 * 1000
  },
  media: {
    book: {
      enabled: true,
      localSyncEnabled: true
    },
    game: {
      enabled: true,
      localSyncEnabled: true
    },
    anime: {
      enabled: true,
      localSyncEnabled: true
    },
    music: {
      enabled: true,
      localSyncEnabled: false
    }
  },
  autoSync: {
    enabled: false,
    syncOnCreate: false,
    playStatusEnabled: true,
    scoreEnabled: true,
    unitProgressEnabled: true,
    clearRemoteScoreWhenEmpty: false,
    debounceMs: 3000,
    notifyErrors: true,
    // One-to-one against Bangumi's wish/collect/do/on-hold/dropped types.
    statusToBangumi: {
      planned: 1,
      active: 3,
      completed: 2,
      onHold: 4,
      dropped: 5
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
